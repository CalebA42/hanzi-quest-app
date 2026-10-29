# Release notes

Each release needs `release-notes/vX.Y.Z.md`, committed before the `vX.Y.Z` tag is pushed. The release workflow stops before building if the file is missing, and uses it as the GitHub release description.

Follow the format of the existing files:

- `## New` and/or `## Fixes`: one bullet per change, a bold one-line summary in plain language for players, then issue and PR numbers, e.g. `(#28, #31)`
- `## Testing status`: what was confirmed and where, plus open items such as #20 and #4
- `## Downloads`: the AppImage, Setup .exe and portable .exe for this version, then the browser link
