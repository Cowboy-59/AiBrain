const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spockai', {
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  getConfig: () => ipcRenderer.invoke('get-config'),
  onTelegramMessage: (callback) => {
    ipcRenderer.on('telegram-message', (event, data) => callback(data));
  }
});
