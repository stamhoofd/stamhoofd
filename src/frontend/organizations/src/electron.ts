import './electron/menu';
import './electron/events';

import { Session } from '@stamhoofd-frontend/users';
import { app, BrowserWindow, systemPreferences } from 'electron'

import { createDashboardWindow,createLoginWindow} from './electron/windows';

const development = !!process.env.ELECTRON_WEBPACK_DEV_SERVER

// For now, we do not support a dark mode yet
systemPreferences.appLevelAppearance = "light"

// Fix for electron 8, set default same as electron 9
app.allowRendererProcessReuse = true


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  Session.restoreFromKeyChain().then((session) => {
    if (session) {
      // Yay! we have a token
      console.log("Found session in keychain", session)
      session.setDefault()

      /*session.token.refresh(session.server).then(() => {
        // todo: do something with the token
        createDashboardWindow()
      }).catch(e => {
        if (e instanceof STErrors) {
          if (e.errors[0].code == "user_not_verified") {
            this.present(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(ConfirmEmailView) }));
          }
        }
      })*/
      createDashboardWindow()
    } else {
      createLoginWindow()
    }
  }).catch(e => {
    console.error(e)
    // Always launch login
    createLoginWindow()
  })
}).catch(e => console.error(e))

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