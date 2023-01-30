import { EncodedResponse, Request, RequestMiddleware, ResponseMiddleware } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";

export class VersionMiddleware implements RequestMiddleware, ResponseMiddleware {
    minimumVersion: number | undefined
    latestVersions: {android: number, ios: number, web: number}

    constructor(options: {latestVersions: {android: number, ios: number, web: number}, minimumVersion?: number}) {
        this.minimumVersion = options.minimumVersion
        this.latestVersions = options.latestVersions
    }

    handleRequest(request: Request) {
        if (!this.minimumVersion) {
            return
        }

        const platform = request.headers["x-platform"];
        const version = request.getVersion()
        if (version < this.minimumVersion) {
            // WARNING: update caddy config for on demand certificates, because we don't want to throw errors over there!
            if (platform === "web" || platform === undefined) {
                throw new SimpleError({
                    code: "client_update_required",
                    statusCode: 400,
                    message: "Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser.",
                    human: "Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser."
                })
            } else {
                throw new SimpleError({
                    code: "client_update_required",
                    statusCode: 400,
                    message: "Er is een noodzakelijke update beschikbaar. Update de app en probeer opnieuw!",
                    human: "Er is een noodzakelijke update beschikbaar. Update de app en probeer opnieuw!"
                })
            }
        }
    }

    handleResponse(request: Request, response: EncodedResponse) {
        const platform = request.headers["x-platform"];

        if (platform === "android") {
            response.headers["X-Platform-Latest-Version"] = this.latestVersions.android
        }
        if (platform === "ios") {
            response.headers["X-Platform-Latest-Version"] = this.latestVersions.ios
        }
        if (platform === "web") {
            response.headers["X-Platform-Latest-Version"] = this.latestVersions.web
        }
    }
}