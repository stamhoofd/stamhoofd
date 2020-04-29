import { BrowserWindow,ipcMain } from 'electron'

import { createLoginWindow } from './windows';

ipcMain.on('logout', () => {
    console.log("Received logout message");
    for (const window of BrowserWindow.getAllWindows()) {
        window.close()
    }
    createLoginWindow()
})