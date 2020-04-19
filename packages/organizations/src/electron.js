const { app, BrowserWindow } = require('electron')
require('./electron/menu');

function createLoginWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 550,
    webPreferences: {
      nodeIntegration: true
    },
    titleBarStyle: 'hiddenInset'
  })

  if (process.env.ELECTRON_WEBPACK_DEV_SERVER) {
    win.loadURL('http://127.0.0.1:8080/login.html')
  } else {
    win.loadFile('dist/login.html')
  }

  // Open the DevTools.
  //win.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createLoginWindow)

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