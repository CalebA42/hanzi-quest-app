const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hanziBridge', {
  version: ipcRenderer.sendSync('get-version'),
  openExternal(url) {
    if (url.startsWith('https://')) ipcRenderer.send('open-external', url);
  }
});
