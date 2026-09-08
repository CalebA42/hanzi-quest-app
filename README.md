# 汉字冒险 · Hanzi Quest — AppImage build

An 8-bit Mandarin reading adventure across HSK levels 1–6, packaged as a
Linux AppImage. The whole game lives in `index.html`; Electron just gives it
a desktop window, a launcher icon, and durable saves.

## Requirements (one-time setup)

- Node.js 18+ and npm. On Ubuntu:

      sudo apt install nodejs npm

  (Check with `node --version`. If your Ubuntu ships something older than 18,
  install from https://nodejs.org or via `nvm`.)

- Internet access for the first `npm install` (it downloads Electron).

## Build

    cd hanzi-quest-app
    npm install
    npm run build

The finished app appears in `dist/`, named something like:

    dist/Hanzi Quest-1.0.0.AppImage

Run it directly, or from the file manager (mark executable if needed):

    chmod +x "dist/Hanzi Quest-1.0.0.AppImage"
    "./dist/Hanzi Quest-1.0.0.AppImage"

Copy that single file to any of your Ubuntu machines — that's the whole app.

## Test without packaging

    npm start

opens the game in a dev window instantly. Useful when iterating on
`index.html` (just replace it with a newer version from Claude and re-run).

## Where saves live

The 存 SAVE button writes to the app's own profile at
`~/.config/hanzi-quest/` — independent of any browser, and it survives
browser-cache cleanups. Delete that folder to fully reset everything.

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

New level content or fixes from Claude arrive as an updated `hanzi-quest.html`.
Just overwrite `index.html` with it and run `npm run build` again.
