import Foundation
import JavaScriptCore
import XCTest
import UIKit
import WebKit
@testable import ParkourEnemies

final class NativeSaveStoreTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!
    private var store: NativeSaveStore!

    override func setUp() {
        super.setUp()
        suiteName = "ParkourEnemiesTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        store = NativeSaveStore(defaults: defaults)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        store = nil
        defaults = nil
        suiteName = nil
        super.tearDown()
    }

    func testSaveAndSoundSurviveANewStoreInstance() throws {
        let save = #"{"coins":12,"owned":["blue","frog"],"skin":"frog","best":3}"#
        XCTAssertTrue(store.set(save, forKey: "parkourEnemies"))
        XCTAssertTrue(store.set("on", forKey: "parkourEnemiesSound"))
        XCTAssertEqual(defaults.string(forKey: "game.store.parkourEnemies"), save)

        let freshDefaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        let reloaded = NativeSaveStore(defaults: freshDefaults)
        XCTAssertEqual(reloaded.snapshot, ["parkourEnemies": save, "parkourEnemiesSound": "on"])
        XCTAssertTrue(reloaded.set("off", forKey: "parkourEnemiesSound"))
        XCTAssertEqual(store.snapshot["parkourEnemiesSound"], "off")
    }

    func testOnlyAllowedKeysCanBeStoredOrExported() {
        XCTAssertFalse(store.set("{}", forKey: "unknown"))
        XCTAssertNil(defaults.object(forKey: "game.store.unknown"))
        defaults.set("{}", forKey: "game.store.unknown")
        defaults.set("{}", forKey: "parkourEnemies")
        XCTAssertEqual(store.snapshot, [:])
    }

    func testMalformedValuesCannotReplaceAValidSave() {
        XCTAssertTrue(store.set("{}", forKey: "parkourEnemies"))
        for value in ["", "{", "[]", "null", "true", "12", #""save""#] {
            XCTAssertFalse(store.set(value, forKey: "parkourEnemies"), value)
        }
        XCTAssertEqual(store.snapshot["parkourEnemies"], "{}")

        for value in ["", "ON", "true", "1", #""on""#] {
            XCTAssertFalse(store.set(value, forKey: "parkourEnemiesSound"), value)
        }
    }

    func testSizeLimitCountsUTF8BytesAndAcceptsTheBoundary() {
        let prefix = #"{"padding":""#
        let suffix = #""}"#
        let overhead = prefix.utf8.count + suffix.utf8.count
        let largestSave = prefix + String(repeating: "a", count: 64 * 1024 - overhead) + suffix
        XCTAssertEqual(largestSave.utf8.count, 64 * 1024)
        XCTAssertTrue(store.set(largestSave, forKey: "parkourEnemies"))
        XCTAssertFalse(store.set(largestSave + " ", forKey: "parkourEnemies"))

        let unicodeSave = prefix + String(repeating: "é", count: 32 * 1024) + suffix
        XCTAssertLessThan(unicodeSave.count, 64 * 1024)
        XCTAssertFalse(store.set(unicodeSave, forKey: "parkourEnemies"))
        XCTAssertEqual(store.snapshot["parkourEnemies"], largestSave)
    }

    func testSnapshotOmitsInvalidPersistedValues() {
        defaults.set("[]", forKey: "game.store.parkourEnemies")
        defaults.set("yes", forKey: "game.store.parkourEnemiesSound")
        XCTAssertEqual(store.snapshot, [:])
    }

    func testInjectionPreservesStringsWithoutExecutingTheirContents() throws {
        let payload = "quotes \" backslash \\ café 🦊 \n\r\t \u{2028} \u{2029} \"; window.__PARKOUR_PWNED__ = true; // </script><script>window.__PARKOUR_PWNED__ = true</script>"
        let data = try JSONSerialization.data(withJSONObject: ["payload": payload])
        let save = try XCTUnwrap(String(data: data, encoding: .utf8))
        XCTAssertTrue(store.set(save, forKey: "parkourEnemies"))
        XCTAssertTrue(store.set("on", forKey: "parkourEnemiesSound"))

        for isActive in [false, true] {
            let script = store.injectionScript(isActive: isActive)
            XCTAssertFalse(script.contains("</script>"))
            XCTAssertFalse(script.contains("\u{2028}"))
            XCTAssertFalse(script.contains("\u{2029}"))
            let context = try XCTUnwrap(JSContext())
            context.evaluateScript("var window = {};")
            context.evaluateScript(script)
            XCTAssertNil(context.exception)
            XCTAssertEqual(context.evaluateScript("window.__PARKOUR_IOS__")?.toBool(), true)
            XCTAssertEqual(context.evaluateScript("window.__PARKOUR_ACTIVE__")?.toBool(), isActive)
            XCTAssertEqual(context.evaluateScript("window.__PARKOUR_SAVED__.parkourEnemies")?.toString(), save)
            XCTAssertEqual(context.evaluateScript("window.__PARKOUR_SAVED__.parkourEnemiesSound")?.toString(), "on")
            XCTAssertEqual(context.evaluateScript("JSON.parse(window.__PARKOUR_SAVED__.parkourEnemies).payload")?.toString(), payload)
            XCTAssertEqual(context.evaluateScript("typeof window.__PARKOUR_PWNED__")?.toString(), "undefined")
        }
    }
}

/// Exercises the bundled game and its actual WKWebView-to-native save bridge.
@MainActor
final class NativeGameIntegrationTests: XCTestCase {
    func testCharacterPurchaseAndCoinsSurviveDocumentReload() async throws {
        let defaults = UserDefaults.standard
        let keys = ["game.store.parkourEnemies", "game.store.parkourEnemiesSound"]
        let previous = keys.map { defaults.object(forKey: $0) }
        let window = try XCTUnwrap(UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }.first { $0.isKeyWindow })
        let previousController = window.rootViewController
        var documents: [WKWebView] = []
        defer {
            for document in documents {
                document.configuration.userContentController.removeScriptMessageHandler(forName: "parkour")
                document.stopLoading()
            }
            window.rootViewController = previousController
            for (key, value) in zip(keys, previous) {
                if let value { defaults.set(value, forKey: key) }
                else { defaults.removeObject(forKey: key) }
            }
        }
        let store = NativeSaveStore()
        XCTAssertTrue(store.set(#"{"coins":1000,"owned":["blue"],"skin":"blue","best":3}"#, forKey: "parkourEnemies"))
        XCTAssertTrue(store.set("off", forKey: "parkourEnemiesSound"))

        func openGame() throws -> WKWebView {
            let controller = GameViewController()
            window.rootViewController = controller
            controller.loadViewIfNeeded()
            controller.setActive(true)
            let document = try XCTUnwrap(controller.view.subviews.compactMap { $0 as? WKWebView }.first)
            documents.append(document)
            return document
        }

        let ready = "document.readyState === 'complete' && typeof window.parkourNative?.pause === 'function' && document.getElementById('btnPlay')?.disabled === false"
        let first = try openGame()
        try await waitUntil(first, ready)
        _ = try await first.evaluateJavaScript("document.getElementById('btnShop').click()")
        try await waitUntil(first, #"document.querySelector('[data-skin="frog"]') && !document.querySelector('[data-skin="frog"] .skin-image-status')"#)
        let displayedCost = try await first.evaluateJavaScript(#"Number(document.querySelector('[data-skin="frog"] .pr').textContent.match(/[0-9]+/)[0])"#)
        let cost = try XCTUnwrap(displayedCost as? Int)
        _ = try await first.evaluateJavaScript(#"document.querySelector('[data-skin="frog"]').click()"#)

        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            if let raw = store.snapshot["parkourEnemies"],
               let data = raw.data(using: .utf8),
               let saved = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               saved["skin"] as? String == "frog" { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let raw = try XCTUnwrap(store.snapshot["parkourEnemies"])
        let saved = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
        XCTAssertEqual(saved["coins"] as? Int, 1000 - cost)
        XCTAssertEqual(saved["skin"] as? String, "frog")
        XCTAssertTrue((saved["owned"] as? [String])?.contains("frog") == true)

        let reloaded = try openGame()
        try await waitUntil(reloaded, ready)
        let balance = try await reloaded.evaluateJavaScript("Number(document.querySelector('.coinTotal').textContent)")
        XCTAssertEqual(balance as? Int, 1000 - cost)
        _ = try await reloaded.evaluateJavaScript("document.getElementById('btnShop').click()")
        let selected = try await reloaded.evaluateJavaScript("document.querySelector('#shopGrid .skin.on')?.dataset.skin")
        XCTAssertEqual(selected as? String, "frog")
    }

    private func waitUntil(_ document: WKWebView, _ condition: String) async throws {
        let deadline = Date().addingTimeInterval(30)
        while Date() < deadline {
            if (try? await document.evaluateJavaScript(condition)) as? Bool == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let state = try? await document.evaluateJavaScript("document.readyState + ': ' + document.body.innerText")
        XCTFail("Bundled game did not become ready: \(condition). State: \(state ?? "unavailable")")
        throw NSError(domain: "NativeGameIntegrationTests", code: 1)
    }
}
