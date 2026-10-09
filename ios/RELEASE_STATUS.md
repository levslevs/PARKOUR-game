# Release status — October 9, 2026

Version 1.0.0, build 1. Publisher: WaiWai, LLC. Free, English, iPhone and iPad. Approved app name: Parkour Enemies. Permission to publish the game and replace the former branded character was confirmed by the requester.

## TestFlight is ready

- App Store Connect app: `6820690237` — https://appstoreconnect.apple.com/apps/6820690237/distribution
- Bundle ID: `school.wai.parkourenemies`; team `R4A779QVVY`.
- Build and delivery ID: `94a37aa2-a2b1-47ae-9f5f-0dbfcb9d8711`.
- Apple processing state: `VALID`; internal build state: `IN_BETA_TESTING`.
- Internal group: `9068e619-c746-4dd8-a9a3-0d9b12420b80`, with access to all builds.
- The requester's Apple ID is the only group member; invitation state confirmed `INVITED`.
- The requester confirmed access to both a real iPhone and iPad for testing.
- The requester explicitly authorized App Review submission on October 9 ("давай отправлять на ревью"). No further submission approval is needed. Detailed real-device test feedback has not been recorded; Apple's feedback and crash-submission endpoints returned no records.

## App Review preparation

- Build 1 is attached to App Store version `61d9c3fd-ccbb-4a80-a527-011a9a620cc0`.
- Availability saved for all 175 Apple territories, including new territories. This is configured availability, not confirmation that the unreleased app is on sale.
- Draft review submission: `52af3386-0a5a-43d2-ace7-0cf2ba7ea2be` (`READY_FOR_REVIEW`, no submitted date).
- Adding the version to that submission returned HTTP 409 with exactly three validation errors: missing iPad 13-inch screenshot, missing accepted large iPhone screenshot, and unpublished App Privacy data-usage answers.
- The browser session exposes App Privacy as read-only and says Account Holders and Admins are responsible for data disclosures. The requester has been asked to involve an authorized administrator to publish "No, we do not collect data from this app."
- **Not submitted to Apple yet.** The draft currently has no version item; retry adding the same version after the validation errors are resolved, then submit the existing draft rather than creating another.

## Completed

- Universal Xcode project, device families 1 and 2, minimum iOS 16.
- Local game bundle, native progress storage, lifecycle pause, privacy/support entry.
- Dash artwork and app icon. Existing character IDs, prices and enemy speeds preserved.
- Game mechanics, touch, rendering, level traversal and native bridge checks passed.
- Native ProgressStore unit test passed on iPhone 17 Pro / iOS 26.5.
- Release archive and IPA export succeeded with Cloud Managed Apple Distribution. Bundled HTML matches the source.
- Support and privacy pages are live on GitHub main; fetched content verified against local sources.
- English listing, review notes and user-provided review contacts saved in Apple. Personal contact details are not stored in this repository.
- Games / Adventure / Action categories, content-rights declaration and free pricing saved.
- Apple's calculated age rating: 9+ (Brazil: 10), based on mild cartoon/fantasy violence and no mature or social content.

## Verification still pending

- The initial iPhone UI test failed while trying to open the character shop. Subsequent runs were blocked during simulator startup or communication; no successful native UI test is claimed.
- iPad UI testing has not completed. Device Hub/CoreSimulator repeatedly became unresponsive, including after a fresh iOS 27 simulator was created.
- Real-device TestFlight feedback, actual iPhone/iPad screenshots, App Privacy answers and final submission remain pending.
- A focused retry on iOS 26.5 successfully booted iPhone 17 Pro Max, installed the app and launched it. UI inspection then stopped because the Mac locked; unlocking was requested. The iOS 27 test simulator was shut down.
- No public App Review or external beta review submission has been made.

## Local artifacts (ignored by Git)

- Current archive: `ios/build/ParkourEnemies-current.xcarchive`
- Uploaded IPA: `ios/build/export-current/ParkourEnemies.ipa`
- Export signing summary: `ios/build/export-current/DistributionSummary.plist`
- Native test reports: `ios/build/*tests.xcresult`
- Source branch: `feature/ios-app-store`. Only support/privacy pages are integrated into main so far.

## Continue

1. Collect any available real-device feedback using `TESTFLIGHT_CHECKLIST.md`; submission is already authorized.
2. Fix reproduced issues; increase `CURRENT_PROJECT_VERSION` before uploading another build. Build 1 has already been uploaded.
3. Finish iPhone/iPad visual checks and capture real app screenshots. Xcode 27 uses Device Hub at `/Applications/Xcode.app/Contents/Applications/DeviceHub.app`.
4. Complete the remaining App Store fields and review the final candidate.
5. Add the version to the existing draft and submit it after Apple validation passes. Verify `WAITING_FOR_REVIEW` or `IN_REVIEW`; integrate the verified source change through the repository's normal Git workflow.

Credentials and signing keys remain outside the repository under the user's `.appstoreconnect` directory.
