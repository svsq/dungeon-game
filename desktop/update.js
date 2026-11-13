// the update from the game's menu (TASKS 1870): electron-updater asks GitHub Releases for the newest build of this one's kind
// (latest*.yml, or win7.yml for the Windows 7 build) and the page shows its state. Nothing here touches the save folder's saves
const { app, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

const DAY = 864e5;
// a wrong word from the network is not the game's fault, and the page says so in plainer words than for any other failure
const OFFLINE = /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|ERR_CONNECTION|ERR_TIMED_OUT|ERR_PROXY|ERR_ADDRESS_UNREACHABLE|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENETUNREACH|socket hang up/;

module.exports = (win, log) => {
  const MEMO = path.join(app.getPath('userData'), 'update.json');
  const dev = process.env.CRYPT_UPDATE_DEV === '1';
  // an AppImage alone can replace itself on Linux; an unpacked folder or a run from the sources has nothing to update
  const can = (app.isPackaged || dev) && (process.platform !== 'linux' || !!process.env.APPIMAGE);
  let st = { can: can ? 1 : 0, st: 'idle', n: 0 }, auto = false, U = null;
  const tell = (o) => { st = Object.assign({}, st, o, { n: st.n + 1 }); if (!win.isDestroyed()) win.webContents.send('upd', st); };
  const memo = () => { try { return JSON.parse(fs.readFileSync(MEMO, 'utf8')); } catch (e) { return {}; } };
  const remember = (o) => { try { fs.writeFileSync(MEMO, JSON.stringify(Object.assign(memo(), o))); } catch (e) {} };

  ipcMain.handle('upd-state', (e) => (e.sender === win.webContents ? st : null));
  if (!can) return;
  try { ({ autoUpdater: U } = require('electron-updater')); } catch (e) { log('update: no electron-updater ' + e.message); tell({ can: 0 }); return; }
  U.logger = { info: (s) => log('update: ' + s), warn: (s) => log('update: ' + s), error: (s) => log('update: ' + s), debug: () => {} };
  U.autoDownload = false;
  if (dev) { U.forceDevUpdateConfig = true; U.setFeedURL({ provider: 'github', owner: 'svsq', repo: 'dungeon-game', channel: process.env.CRYPT_UPDATE_CHANNEL || undefined }); }

  U.on('update-available', (i) => { auto = false; remember({ at: Date.now(), v: i.version }); tell({ st: 'avail', v: i.version, pct: 0, err: '' }); });
  // a quiet check that found nothing leaves the menu as it was
  U.on('update-not-available', () => { remember({ at: Date.now(), v: '' }); tell(auto ? { st: 'idle' } : { st: 'none', v: app.getVersion() }); auto = false; });
  U.on('download-progress', (p) => tell({ st: 'down', pct: Math.max(0, Math.min(100, Math.floor(p.percent || 0))) }));
  U.on('update-downloaded', (i) => tell({ st: 'ready', v: i.version, pct: 100 }));
  U.on('error', (e) => { const s = String((e && (e.stack || e.message)) || e); log('update: error ' + s.split('\n')[0]);
    const was = auto; auto = false;
    if (was) { tell({ st: 'idle' }); return; }
    tell({ st: 'err', err: OFFLINE.test(s) ? 'net' : st.st === 'down' ? 'down' : 'other' }); });

  const check = (quiet) => { if (st.st === 'check' || st.st === 'down') return; auto = !!quiet; if (!quiet) tell({ st: 'check', err: '' });
    U.checkForUpdates().then((r) => { if (!r && !quiet) tell({ st: 'err', err: 'other' }); }).catch(() => {}); };
  ipcMain.on('upd', (e, k) => {
    if (e.sender !== win.webContents) return;
    if (k === 'check') check(false);
    else if (k === 'get' && (st.st === 'avail' || (st.st === 'err' && st.err === 'down'))) { tell({ st: 'down', pct: 0, err: '' }); U.downloadUpdate().catch(() => {}); }
    // the page has written its save before it asks (see index.html), and the installer starts once the window is gone
    else if (k === 'run' && st.st === 'ready') { log('update: restart into ' + st.v); session.defaultSession.flushStorageData(); setImmediate(() => U.quitAndInstall(true, true)); }
  });
  // at the start, at most once a day; a version found and not yet taken is asked for again at every start, or its mark would go
  win.webContents.once('did-finish-load', () => { const m = memo();
    if (!(Date.now() - (m.at || 0) < DAY) || m.v) setTimeout(() => { if (st.st === 'idle') check(true); }, 4000); });
};
