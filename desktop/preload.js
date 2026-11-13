const { contextBridge, ipcRenderer } = require('electron');

let full = false;
const subs = [];
ipcRenderer.on('full', (e, on) => { full = !!on; for (const f of subs) f(full); });
const aways = [];
const upds = [];
ipcRenderer.on('upd', (e, st) => { for (const f of upds) f(st); });
ipcRenderer.on('away', () => { for (const f of aways) f(); });

// the window's fullscreen for the settings' row (TASKS 1864): F11 and the menu change the window, not the page's Fullscreen API
contextBridge.exposeInMainWorld('desktop', {
  isFull: () => full,
  setFull: (on) => ipcRenderer.send('set-full', !!on),
  onFull: (f) => { subs.push(f); },
  // the main menu's «Выход» (TASKS 1877): the page has written its save by then
  quit: () => ipcRenderer.send('quit'),
  // the window lost to another one (TASKS 1882): the page pauses a run as on Esc
  onAway: (f) => { aways.push(f); },
  // a stage of the page's start, for boot.log in the save folder (TASKS 2004)
  bootLog: (s) => ipcRenderer.send('boot-log', String(s)),
  // the update from the menu (TASKS 1870): its state from the main process, and the menu's asks (check, get, run)
  update: { state: () => ipcRenderer.invoke('upd-state'), on: (f) => { upds.push(f); }, ask: (k) => ipcRenderer.send('upd', String(k)) },
});
