const { app, BrowserWindow, Menu, protocol, net, shell, ipcMain } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const GAME = path.join(__dirname, 'game');

// The save folder keeps the old product name: renaming the game must not lose a player's progress.
app.setPath('userData', path.join(app.getPath('appData'), 'Глубины Крипты'));

// A fixed privileged origin keeps localStorage (meta progress, the saved run) stable across launches and app updates.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

const toggleFullscreen = (win) => win.setFullScreen(!win.isFullScreen());

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, backgroundColor: '#000000', title: 'The Elder Deep: Below the Ages',
    autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required', preload: path.join(__dirname, 'preload.js') },
  });
  win.once('ready-to-show', () => win.show());
  const tellFull = () => win.webContents.send('full', win.isFullScreen());
  for (const e of ['enter-full-screen', 'leave-full-screen']) win.on(e, tellFull);
  win.webContents.on('did-finish-load', tellFull);
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
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname);
    const file = path.normalize(path.join(GAME, rel));
    if (!file.startsWith(GAME + path.sep)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

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
  app.on('second-instance', () => { if (win.isMinimized()) win.restore(); win.focus(); });
});

app.on('window-all-closed', () => app.quit());
