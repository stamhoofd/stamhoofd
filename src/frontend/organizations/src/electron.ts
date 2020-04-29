import './electron/menu';

import { app, BrowserWindow, systemPreferences } from 'electron'

const development = !!process.env.ELECTRON_WEBPACK_DEV_SERVER

// For now, we do not support a dark mode yet
systemPreferences.appLevelAppearance = "light"

// Fix for electron 8, set default same as electron 9
app.allowRendererProcessReuse = true

function createLoginWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 700 + 675, // dev console width = 675
    height: 500,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false, // disable CORS... This should not be a problem since we'll only load local files, never never load files from a remote server
      allowRunningInsecureContent: false,
      enableRemoteModule: false,

    },
    titleBarStyle: 'hiddenInset'
  })

  // Todo: disable resize in production
  //win.resizable = false;
  win.maximizable = false;

  if (process.env.ELECTRON_WEBPACK_DEV_SERVER) {
    win.loadURL('http://127.0.0.1:8080/login.html').catch(e => console.error(e))
  } else {
    win.loadFile('dist/login.html').catch(e => console.error(e))
  }

  // Open the DevTools.
  win.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createLoginWindow).catch(e => console.error(e))

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createLoginWindow()
  }
})

// Disable navigation away from our secure, static files
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)

    if (development) {
      if (parsedUrl.origin != "http://127.0.0.1:8080") {
        console.warn("Prevented insecure navigation")
        event.preventDefault()
      }
    } else {
      if (parsedUrl.protocol != "file") {
        console.warn("Prevented insecure navigation")
        event.preventDefault()
      }
    }
  })
});