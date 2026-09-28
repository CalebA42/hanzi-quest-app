# 汉字冒险 · Hanzi Quest

An 8-bit Mandarin reading adventure across HSK levels 1–6. The whole game
lives in `index.html`; Electron packages it as a native desktop app with a
launcher icon and durable saves.

## Download a release (Linux & Windows)

Go to the [Releases page](../../releases) and grab the file for your platform:

| Platform | File | Notes |
|----------|------|-------|
| Linux    | `Hanzi Quest-x.x.x.AppImage` | Mark executable, then run |
| Windows  | `Hanzi Quest Setup x.x.x.exe` | Installer — adds Start Menu entry + uninstaller |
| Windows  | `Hanzi Quest x.x.x.exe` | Portable — runs without installing |

### Windows SmartScreen warning

Because the build is unsigned, Windows will show a SmartScreen prompt the
first time you run either `.exe`. Click **More info → Run anyway** to proceed.
This is expected for unsigned open-source apps.

## Building from source

### Requirements (one-time setup)

- Node.js 18+ and npm. On Ubuntu:

      sudo apt install nodejs npm

  (Check with `node --version`. If your Ubuntu ships something older than 18,
  install from https://nodejs.org or via `nvm`.)

- Internet access for the first `npm install` (it downloads Electron).

### Build

    cd hanzi-quest-app
    npm install

    # Linux AppImage
    npm run build

    # Windows installer + portable (run on Windows or in CI)
    npm run build:win

    # Both platforms at once
    npm run build:all

The finished files appear in `dist/`:

    dist/Hanzi Quest-1.0.0.AppImage          ← Linux
    dist/Hanzi Quest Setup 1.0.0.exe         ← Windows installer
    dist/Hanzi Quest 1.0.0.exe               ← Windows portable

**Linux:** mark executable and run:

    chmod +x "dist/Hanzi Quest-1.0.0.AppImage"
    "./dist/Hanzi Quest-1.0.0.AppImage"

Copy that single file to any Linux machine — that's the whole app.

### Automated releases (GitHub Actions)

Pushing a version tag builds both platforms and attaches the artifacts to a
GitHub Release automatically:

    git tag v1.1.0
    git push origin v1.1.0

## Test without packaging

    npm start

opens the game in a dev window instantly. Useful when iterating on
`index.html` (just replace it with a newer version from the developer and re-run).

## Where saves live

The 存 SAVE button writes to the app's own profile directory — independent
of any browser, and it survives browser-cache cleanups. Delete the folder to
fully reset everything.

| Platform | Path |
|----------|------|
| Linux    | `~/.config/Hanzi Quest/` |
| Windows  | `%APPDATA%\Hanzi Quest\` |

## Troubleshooting

**"AppImages require FUSE" / the AppImage won't start.**
Ubuntu 22.04+ doesn't ship libfuse2 by default:

    sudo apt install libfuse2

**The 🔊 button is silent.**
Speech uses the system's voices via speech-dispatcher. Install a Mandarin-
capable engine:

    sudo apt install speech-dispatcher espeak-ng

then restart the app. (The espeak voice is robotic but serviceable; we can
bundle recorded audio in a future version if it bothers you.)

**`npm run build` fails downloading Electron.**
Corporate proxies/firewalls sometimes block the download. Re-run on a normal
connection; everything is cached after the first success.

## Updating the game later

New level content or fixes from the developer arrive as an updated `hanzi-quest.html`.
Just overwrite `index.html` with it and run `npm run build` again.
