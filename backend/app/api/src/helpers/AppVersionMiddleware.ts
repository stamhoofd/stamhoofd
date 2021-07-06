import { EncodedResponse, Request, ResponseMiddleware } from "@simonbackx/simple-endpoints";

export const AppVersionMiddleware: ResponseMiddleware = {
    handleResponse(request: Request, response: EncodedResponse) {
        const platform = request.headers["x-platform"];

        if (platform === "android" && process.env.LATEST_ANDROID_VERSION) {
            response.headers["X-Platform-Latest-Version"] = process.env.LATEST_ANDROID_VERSION
        }
        if (platform === "ios" && process.env.LATEST_IOS_VERSION) {
            response.headers["X-Platform-Latest-Version"] = process.env.LATEST_IOS_VERSION
        }
    }
}