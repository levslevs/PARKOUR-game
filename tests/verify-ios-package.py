#!/usr/bin/env python3
"""Check the offline iPad resource and native configuration without Xcode."""

import base64
from html.parser import HTMLParser
import json
from pathlib import Path
import plistlib
import re
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "ios" / "ParkourEnemies"
PROJECT = ROOT / "ios" / "ParkourEnemies.xcodeproj" / "project.pbxproj"


class ResourceParser(HTMLParser):
    """Collect dependencies that would need separate files or network access."""

    def __init__(self):
        super().__init__()
        self.dependencies = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag in {"script", "img", "source", "video", "audio", "iframe"}:
            if values.get("src"):
                self.dependencies.append(values["src"])
        if tag == "link" and values.get("href"):
            self.dependencies.append(values["href"])
        if tag == "video" and values.get("poster"):
            self.dependencies.append(values["poster"])


class OfflinePackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="parkour-ios-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.outputs = [Path(cls.temp.name) / name / "game.html" for name in ("first", "second")]
        for output in cls.outputs:
            result = subprocess.run(
                [sys.executable, str(ROOT / "tools" / "build_ios.py"), "--output", str(output)],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            if result.returncode:
                raise RuntimeError(f"iPad build failed:\n{result.stdout}{result.stderr}")
            if str(output) not in result.stdout:
                raise RuntimeError("The iPad builder did not report its output path.")
        cls.html = cls.outputs[0].read_text(encoding="utf-8")

    def test_build_is_deterministic(self):
        self.assertEqual(self.outputs[0].read_bytes(), self.outputs[1].read_bytes())
        self.assertTrue(self.html.startswith("<!DOCTYPE html>"))
        self.assertNotIn(b"\r\n", self.outputs[0].read_bytes())

    def test_game_has_no_external_resource_dependencies(self):
        parser = ResourceParser()
        parser.feed(self.html)
        self.assertEqual(
            [url for url in parser.dependencies if not url.startswith("data:")],
            [],
            "The native game must work without a network connection or companion files.",
        )
        css_urls = re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", self.html)
        self.assertEqual([url for url in css_urls if not url.startswith("data:")], [])
        self.assertNotRegex(self.html, r"(?i)@import\s")

    def test_all_character_images_are_embedded_pngs(self):
        match = re.search(r"\bvar ASSET_SRC = (\{[^\n]+\});", self.html)
        self.assertIsNotNone(match, "The offline package is missing embedded artwork.")
        assets = json.loads(match.group(1))
        metadata = json.loads((ROOT / "src" / "sprite-metadata.json").read_text(encoding="utf-8"))
        self.assertEqual(set(assets), set(metadata))
        for name, uri in assets.items():
            with self.subTest(character=name):
                self.assertTrue(uri.startswith("data:image/png;base64,"))
                actual = base64.b64decode(uri.split(",", 1)[1], validate=True)
                self.assertEqual(actual, (ROOT / "assets" / f"{name}.png").read_bytes())


class NativeConfigurationTests(unittest.TestCase):
    def test_required_native_files_exist(self):
        for relative in (
            "AppDelegate.swift",
            "GameViewController.swift",
            "Info.plist",
            "PrivacyInfo.xcprivacy",
            "Assets.xcassets/Contents.json",
        ):
            with self.subTest(file=relative):
                self.assertTrue((APP / relative).is_file(), f"Missing iPad app file: {relative}")
        self.assertTrue(PROJECT.is_file(), "The Xcode project is missing.")

    def test_ipad_and_offline_native_settings(self):
        info = plistlib.loads((APP / "Info.plist").read_bytes())
        self.assertEqual(
            set(info["UISupportedInterfaceOrientations~ipad"]),
            {
                "UIInterfaceOrientationPortrait",
                "UIInterfaceOrientationPortraitUpsideDown",
                "UIInterfaceOrientationLandscapeLeft",
                "UIInterfaceOrientationLandscapeRight",
            },
        )
        self.assertTrue(info["UIRequiresFullScreen"])
        self.assertNotIn("NSAppTransportSecurity", info, "An offline game does not need network exceptions.")

        project = PROJECT.read_text(encoding="utf-8")
        families = re.findall(r"\bTARGETED_DEVICE_FAMILY\s*=\s*\"?([^;\"\n]+)\"?;", project)
        self.assertTrue(families, "The project must declare its device family.")
        self.assertEqual({family.strip() for family in families}, {"2"})
        targets = re.findall(r"\bIPHONEOS_DEPLOYMENT_TARGET\s*=\s*\"?([^;\"\n]+)\"?;", project)
        self.assertTrue(targets, "The project must declare its iOS deployment target.")
        self.assertEqual({target.strip() for target in targets}, {"16.0"})
        self.assertIn("ParkourEnemies/Info.plist", project)
        self.assertIn("build_ios.py", project)
        self.assertIn("ParkourEnemies/Game/parkour-enemies.html", project)
        self.assertRegex(project, r"lastKnownFileType\s*=\s*folder;\s*(?:name\s*=\s*Game;\s*)?path\s*=\s*Game;")
        self.assertIn("PrivacyInfo.xcprivacy in Resources", project)

    def test_webview_loads_the_bundled_game(self):
        controller = (APP / "GameViewController.swift").read_text(encoding="utf-8")
        self.assertIn("import WebKit", controller)
        self.assertIn("WKWebView", controller)
        self.assertIn("loadFileURL", controller)
        self.assertIn('"parkour-enemies"', controller)
        self.assertIn('"html"', controller)
        self.assertIn('"Game"', controller)

    def test_privacy_manifest_is_valid(self):
        manifest = plistlib.loads((APP / "PrivacyInfo.xcprivacy").read_bytes())
        self.assertIs(manifest["NSPrivacyTracking"], False)
        self.assertEqual(manifest.get("NSPrivacyCollectedDataTypes", []), [])
        self.assertEqual(manifest.get("NSPrivacyTrackingDomains", []), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
