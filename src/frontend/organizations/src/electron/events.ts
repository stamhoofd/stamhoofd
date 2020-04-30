import { SessionManager } from '@stamhoofd-frontend/users';
import { BrowserWindow,ipcMain } from 'electron'

import { createLoginWindow } from './windows';

ipcMain.on('logout', () => {
    console.log("Received logout message");
    for (const window of BrowserWindow.getAllWindows()) {
        window.close()
    }

    // Todo: improve this a bit
    SessionManager.setSessions([]).catch(e => {
        console.error(e)
    }).finally(() => {
        createLoginWindow()
    });
})