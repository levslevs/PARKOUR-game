# Release status — October 8, 2026

Version 1.0.0, build 1. Publisher: WaiWai, LLC. Free, English, iPhone and iPad. Approved app name: Parkour Enemies. Permission to publish the game and replace the former branded character was confirmed by the requester.

## Completed

- Universal Xcode project with device families 1 and 2, minimum iOS 16.
- Local game bundle, native progress storage, lifecycle pause, privacy/support entry.
- Dash artwork and app icon. Existing character IDs, prices and enemy speeds preserved.
- Simulator build succeeded.
- Game mechanics, touch, render, level and native bridge checks passed.
- Native ProgressStore unit test passed on iPhone 17 Pro / iOS 26.5.
- Release archive succeeded with automatic signing for team `R4A779QVVY`.
- IPA export succeeded; DistributionSummary confirms Cloud Managed Apple Distribution.
- Bundle ID `school.wai.parkourenemies` registered; identifier resource ID `338N56WJ34`.
- English listing text and public support/privacy source pages prepared.

## Not yet completed

- Native UI test on iPhone stopped at opening the character shop; it must be rerun and investigated on an unlocked Mac. No passing iPhone UI result is claimed.
- iPad UI test could not finish while the host became unavailable and was interrupted. The task's simulators are shut down.
- Real-device testing, final iPhone/iPad screenshots, App Store Connect app record, upload, TestFlight processing and App Review submission remain pending.
- Computer Use explicitly reported the Mac is locked. The requester was asked to unlock it; no further UI actions should run until it is unlocked.
- At the last API check there was no App Store Connect app record for this bundle ID.
- No app has been uploaded or submitted. Public support/privacy URLs become valid only after the source change is integrated into GitHub main.

## Local build artifacts (ignored by Git)

- `ios/build/ParkourEnemies.xcarchive`
- `ios/build/export/ParkourEnemies.ipa`
- `ios/build/export/DistributionSummary.plist`
- `ios/build/iphone-tests.xcresult` and its exported attachments
- `ios/build/ipad-tests.xcresult` (interrupted)

## Continue

1. Unlock the Mac and rerun the focused native UI test sequentially on iPhone and iPad. Inspect screenshots; investigate any remaining failure rather than bypassing it.
2. Collect actual app screenshots for both device families. Test iPad portrait and landscape and both iPhone landscape directions.
3. Review and integrate the source branch; verify public support and privacy links.
4. In the publisher's authenticated App Store Connect session, create the app using `ios/app-store/metadata.json` and the registered bundle ID.
5. Rebuild and export the final verified source, then upload the signed IPA using the existing credentials outside this repository. The current archive predates a whitespace-only HTML rebuild. Increase the build number if a previous build was uploaded.
6. Confirm processing is VALID, arrange TestFlight testing, then complete metadata, privacy, age rating and eligible territories before App Review submission.

No secrets are stored here. Existing API and export configuration are outside the repository under the user's `.appstoreconnect` directory.
