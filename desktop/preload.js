const { contextBridge, ipcRenderer } = require('electron');

let full = false;
const subs = [];
ipcRenderer.on('full', (e, on) => { full = !!on; for (const f of subs) f(full); });
const aways = [];
ipcRenderer.on('away', () => { for (const f of aways) f(); });

// the window's fullscreen for the settings' row (TASKS 1864): F11 and the menu change the window, not the page's Fullscreen API
contextBridge.exposeInMainWorld('desktop', {
  isFull: () => full,
  setFull: (on) => ipcRenderer.send('set-full', !!on),
  onFull: (f) => { subs.push(f); },
  // the main menu's «Выход» (TASKS 1870): the page has written its save by then
  quit: () => ipcRenderer.send('quit'),
  // the window lost to another one (TASKS 1875): the page pauses a run as on Esc
  onAway: (f) => { aways.push(f); },
});
