# Parkour Enemies for iPhone and iPad

Universal UIKit/WKWebView app, minimum iOS/iPadOS 16.0. iPhone supports both landscape directions; iPad supports all orientations. The game and art are bundled offline. No runtime packages, network services, analytics, advertisements, accounts, or in-app purchases are required.

- Bundle identifier: `school.wai.parkourenemies`
- Signing team: `R4A779QVVY` (WaiWai, LLC), automatic signing
- Project and shared scheme: `ParkourEnemies`
- Progress: native UserDefaults; the browser edition continues using localStorage
- Language: English

## Build

First rebuild the HTML after changes to game sources or art. Use Python 3.10 or newer; this Mac's `/opt/homebrew/bin/python3.13` is suitable, while `/usr/bin/python3` is too old.

```sh
python3 tools/build.py
npm test
xcodebuild -project ios/ParkourEnemies.xcodeproj -scheme ParkourEnemies \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

Open `ios/ParkourEnemies.xcodeproj` to run on a device. The project copies the generated root HTML into the bundle, so an HTML rebuild is required before archiving game changes.

## Focused tests

Run `ParkourEnemiesTests` and `ParkourEnemiesUITests` sequentially on one simulator at a time. The UI test uses a Debug-only fixture to verify a real character unlock, relaunch persistence, gameplay controls, and background pause. Release builds do not include fixture code.

```sh
xcodebuild -project ios/ParkourEnemies.xcodeproj -scheme ParkourEnemies \
  -destination 'platform=iOS Simulator,id=<device-id>' \
  -parallel-testing-enabled NO -only-testing:ParkourEnemiesTests \
  -only-testing:ParkourEnemiesUITests test
```

## Distribution

Increase `CURRENT_PROJECT_VERSION` before every new upload. Archive with Xcode automatic provisioning, export with an App Store Connect export options plist, then upload the IPA. Credentials and signing keys stay outside this repository.

```sh
xcodebuild -project ios/ParkourEnemies.xcodeproj -scheme ParkourEnemies \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath ios/build/ParkourEnemies.xcarchive -allowProvisioningUpdates archive
```

Public support and privacy pages are under `docs/`. Inspect the final Release build on iPhone and iPad before submission. App Review determines the final age rating from the content questionnaire.
