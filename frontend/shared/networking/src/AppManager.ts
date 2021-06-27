export class AppManager {
    static shared = new AppManager()

    isNative = false
    platform: "android" | "ios" | "web" = "web"
}