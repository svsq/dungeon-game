const T0 = Date.now();
const { app, BrowserWindow, Menu, protocol, net, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const GAME = path.join(__dirname, 'game');

// The save folder keeps the old product name: renaming the game must not lose a player's progress.
app.setPath('userData', path.join(app.getPath('appData'), 'Глубины Крипты'));

// A fixed privileged origin keeps localStorage (meta progress, the saved run) stable across launches and app updates.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// a second instance must exit before the log below: only the lock holder may write boot.log
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// the start's log (TASKS 2004): the window's and the page's stages with their times, rewritten at every launch, so a player whose
// game takes long to open can send boot.log from the save folder
const LOG = path.join(app.getPath('userData'), 'boot.log');
const log = (s) => { try { fs.appendFileSync(LOG, `${String(Date.now() - T0).padStart(6)} ms  ${s}\n`); } catch (e) {} };
try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.writeFileSync(LOG, `${new Date().toISOString()}  ${process.platform} ${process.arch} ${process.getSystemVersion()}  electron ${process.versions.electron}  app ${app.getVersion()}\n`); } catch (e) {}
log('main: started');

const toggleFullscreen = (win) => win.setFullScreen(!win.isFullScreen());

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, backgroundColor: '#0b0806', title: 'The Elder Deep: Below the Ages',
    autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required', preload: path.join(__dirname, 'preload.js') },
  });
  win.once('ready-to-show', () => { log('main: ready-to-show'); win.show(); });
  win.webContents.on('did-finish-load', () => { log('main: did-finish-load'); log('gpu features: ' + JSON.stringify(app.getGPUFeatureStatus())); });
  win.webContents.on('render-process-gone', (e, d) => log('main: renderer gone ' + d.reason));
  const tellFull = () => win.webContents.send('full', win.isFullScreen());
  for (const e of ['enter-full-screen', 'leave-full-screen']) win.on(e, tellFull);
  win.webContents.on('did-finish-load', tellFull);
  for (const e of ['blur', 'minimize', 'hide']) win.on(e, () => win.webContents.send('away'));
  win.webContents.on('before-input-event', (e, inp) => {
    if (inp.type !== 'keyDown') return;
    if (inp.code === 'F11' || (inp.alt && inp.code === 'Enter')) { toggleFullscreen(win); e.preventDefault(); }
    else if (inp.code === 'F12') { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL('app://game/index.html');
  return win;
};

app.whenReady().then(() => {
  log('main: ready');
  app.getGPUInfo('basic').then((g) => log('gpu: ' + JSON.stringify((g.gpuDevice || []).map((d) => ({ vendor: d.vendorId, device: d.deviceId, active: d.active, driver: d.driverVersion }))))).catch(() => {});
  app.on('child-process-gone', (e, d) => log(`main: ${d.type} process gone ${d.reason}`));
  const fileOf = (url) => { const file = path.normalize(path.join(GAME, decodeURIComponent(new URL(url).pathname))); return file.startsWith(GAME + path.sep) ? file : null; };
  if (protocol.handle) protocol.handle('app', (req) => { const file = fileOf(req.url); return file ? net.fetch(pathToFileURL(file).toString()) : new Response('forbidden', { status: 403 }); });
  // Electron 22, the Windows 7 build's (TASKS 2005), has no protocol.handle (it came in 25); -10 is net::ERR_ACCESS_DENIED
  else protocol.registerFileProtocol('app', (req, cb) => { const file = fileOf(req.url); cb(file ? { path: file } : { error: -10 }); });

  // the run journal button: save straight to Downloads instead of a save dialog
  require('electron').session.defaultSession.on('will-download', (e, item) => {
    item.setSavePath(path.join(app.getPath('downloads'), item.getFilename()));
  });

  // macOS needs an app menu for Cmd+Q / Cmd+H; elsewhere a menu bar would only steal Alt from the game
  Menu.setApplicationMenu(process.platform === 'darwin'
    ? Menu.buildFromTemplate([{ role: 'appMenu' }, { label: 'Вид', submenu: [{ role: 'togglefullscreen' }, { role: 'toggleDevTools' }] }])
    : null);

  const win = createWindow();
  ipcMain.on('set-full', (e, on) => { if (e.sender === win.webContents && win.isFullScreen() !== on) win.setFullScreen(on); });
  ipcMain.on('quit', (e) => { if (e.sender === win.webContents) app.quit(); });
  ipcMain.on('boot-log', (e, s) => { if (e.sender === win.webContents) log('page: ' + String(s).slice(0, 2000)); });
  require('./update')(win, log);
  app.on('second-instance', () => { if (win.isMinimized()) win.restore(); win.focus(); });
});

app.on('window-all-closed', () => app.quit());
