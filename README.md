# Parkour Enemies

A jumping game by Lev. Collect coins, avoid enemies, and unlock characters.

## Play

Open `parkour-enemies.html` in your browser. The game works offline.

The universal iPhone and iPad app is in [`ios/`](ios/README.md).
[Support](docs/support.md) · [Privacy policy](docs/privacy.md)

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
