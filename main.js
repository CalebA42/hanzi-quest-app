const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");

// Single instance — a second launch just focuses the existing window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 780,
    height: 980,
    minWidth: 420,
    minHeight: 640,
    backgroundColor: "#141021",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  Menu.setApplicationMenu(null); // no menu bar; the game is the whole UI
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) {
      e.preventDefault();
      if (url.startsWith("https://")) shell.openExternal(url);
    }
  });
  win.loadFile("index.html");
}

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("get-version", e => { e.returnValue = app.getVersion(); });
ipcMain.on("open-external", (_, url) => {
  if (url.startsWith("https://")) shell.openExternal(url);
});
