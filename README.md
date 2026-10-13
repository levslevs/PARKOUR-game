# Parkour Enemies

A jumping game by Lev. Collect coins, avoid enemies, and unlock characters.

## Play

Open `parkour-enemies.html` in your browser. The game works offline.

## Play on iPad

The iOS app is in `ios/ParkourEnemies.xcodeproj`. It supports iPadOS 16 or newer.
The game and pictures are included in the app, so it works offline.
Coins, unlocked characters, the selected character, best round and sound choice
are saved on the iPad. An unfinished run stays paused when you switch apps or
rotate the iPad; after closing the app, a new run starts at Round 1.

1. Open `ios/ParkourEnemies.xcodeproj` in Xcode on a Mac. Python 3.10 or newer is required.
2. Select the **ParkourEnemies** scheme and an iPad simulator.
3. Press **Run** (⌘R).

To install on a real iPad, connect it to the Mac, select it in Xcode, and choose
your Apple team under **Signing & Capabilities**. Change the bundle identifier
from `com.lev.parkourenemies` if your team needs a unique one.
Follow Xcode's device setup prompts, then press **Run**.

Xcode rebuilds the game from `src/` before compiling the app. The generated
`ios/ParkourEnemies/Game/parkour-enemies.html` is ignored by Git.
You can also build that resource directly:

```sh
npm run build:ios
npm run test:ios
```

Xcode's **Test** command (⌘U) checks native save handling, character purchases,
coins after reload, touch controls, rotation, background pause and sound
persistence. The browser checks are:

```sh
npm install
npm run browser:install
node tests/verify-ios-support.cjs --browser
npm run test:browser
```

This project is ready for local development and device testing. App Store or
TestFlight distribution still needs your Apple Developer account, signing,
an App Store Connect listing, screenshots and Apple's review.
The app uses [Apple's WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)
to run the existing game, with native app lifecycle and local saves.

## Change the game

- Character names and prices: `src/characters.json`
- Levels and enemy speeds: `src/level-layout.js`
- Game rules: `src/game-base.js`
- Character pictures: `assets/`

Edit the source files, then build the playable game:

```sh
python3 tools/build.py
```

Python 3.10 or newer is required. No extra Python packages are needed.

For game checks with Node.js 20 or newer:

```sh
npm test
```

## Current changes

Paid characters cost twice the original prices. Enemies move 15% slower.

## GitHub

This folder is connected to https://github.com/levslevs/PARKOUR-game.

Changes are saved locally first. Pushing sends committed changes to GitHub.
