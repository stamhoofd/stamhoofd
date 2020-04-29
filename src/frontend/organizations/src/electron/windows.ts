
import { app, BrowserWindow, systemPreferences } from 'electron'

export function createLoginWindow() {
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


export function createDashboardWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 1200 + 675, // dev console width = 675
        height: 800,
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
        win.loadURL('http://127.0.0.1:8080/index.html').catch(e => console.error(e))
    } else {
        win.loadFile('dist/index.html').catch(e => console.error(e))
    }

    // Open the DevTools.
    win.webContents.openDevTools()
}