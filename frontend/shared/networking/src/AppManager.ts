export class AppManager {
    static shared = new AppManager()

    platform: "android" | "ios" | "web" = "web"

    /// If needed: in the app we need to override XMLHttpRequest with native http requests to prevent CORS in some API's
    overrideXMLHttpRequest?: any

    get isNative(): boolean {
        return this.platform !== "web"
    }

    hapticWarning = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 100, 100]);
        }
    }

    hapticError = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 100, 100]);
        }
    }

    hapticSuccess = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate(100);
        }
    }
}