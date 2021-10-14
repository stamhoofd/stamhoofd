import { EncodedResponse, Request, RequestMiddleware,ResponseMiddleware } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Version } from "@stamhoofd/structures";

export const AppVersionMiddleware: ResponseMiddleware & RequestMiddleware = {
    handleRequest(request: Request) {
        if (request.method == "OPTIONS") {
            return
        }
        const platform = request.headers["x-platform"];
        const version = request.getVersion()
        if (version < 129) {
            if (platform === "web" || platform === undefined) {
                throw new SimpleError({
                    code: "outdated_client",
                    statusCode: 400,
                    message: "Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser.",
                    human: "Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser."
                })
            } else {
                throw new SimpleError({
                    code: "outdated_client",
                    statusCode: 400,
                    message: "Er is een noodzakelijke update beschikbaar. Update de app en probeer opnieuw!",
                    human: "Er is een noodzakelijke update beschikbaar. Update de app en probeer opnieuw!"
                })
            }
        }
    },

    handleResponse(request: Request, response: EncodedResponse) {
        const platform = request.headers["x-platform"];

        if (platform === "android" && process.env.LATEST_ANDROID_VERSION) {
            response.headers["X-Platform-Latest-Version"] = process.env.LATEST_ANDROID_VERSION
        }
        if (platform === "ios" && process.env.LATEST_IOS_VERSION) {
            response.headers["X-Platform-Latest-Version"] = process.env.LATEST_IOS_VERSION
        }
        if (platform === "web") {
            response.headers["X-Platform-Latest-Version"] = Version
        }
    }
}