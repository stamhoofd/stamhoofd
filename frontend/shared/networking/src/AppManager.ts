export class AppManager {
    static shared = new AppManager()

    platform: "android" | "ios" | "web" = "web"

    get isNative(): boolean {
        return this.platform !== "web"
    }
}