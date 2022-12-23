import { EncodedResponse, Request, RequestMiddleware,ResponseMiddleware } from "@simonbackx/simple-endpoints";
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { logger, StyledText } from "@simonbackx/simple-logging";
import { Version } from "@stamhoofd/structures";
let requestCounter = 0;

function logRequestDetails(request: Request) {
    if (Object.keys(request.query).length) {
        const json: any = {...request.query}
        if (json && json.password) {
            json.password = '*******'
        }
        logger.error(
            ...requestPrefix(request, 'query'),
            "Request query was ",
            json
        )
    }

    request.body.then((body) => {
        if (!body) {
            return
        }
        try {
            const json = JSON.parse(body)
            if (Array.isArray(json) || Object.keys(json).length) {
                if (json && json.password) {
                    json.password = '*******'
                }

                logger.error(
                    ...requestPrefix(request, 'body'),
                    "Request body was ",
                    json
                )
            }
        } catch (e) {
            logger.error(
                ...requestPrefix(request, 'body'),
                "Request body was ",
                body
            )
        }
    }).catch(console.error)
}

function requestOneLiner(request: Request): (StyledText | string)[]  {
    return [
        new StyledText(request.method).addClass('request', 'method', request.method.toLowerCase()),
        ' ',
        new StyledText(request.url).addClass('request', 'url'),
        ' (',
            new StyledText(request.getIP()).addClass('request', 'ip'),
            '@',
            new StyledText(request.host).addClass('request', 'host'),
        ')'
    ]
}

function requestPrefix(request: Request, ...classes: string[]): (StyledText | string)[] {
    return [
        new StyledText(`[R${((request as any)._uniqueIndex as number).toString().padStart(4, "0")}]`).addClass('request', 'tag', ...classes),
        ' '
    ]
}

export const AppVersionMiddleware: ResponseMiddleware & RequestMiddleware = {
    handleRequest(request: Request) {
        (request as any)._uniqueIndex = requestCounter++
        (request as any)._startTime = process.hrtime();

        if (request.method == "OPTIONS") {
            if (STAMHOOFD.environment === "development") {
                logger.log(
                    ...requestPrefix(request),
                    ...requestOneLiner(request)
                )
            }
            return
        }

        logger.log(
            ...requestPrefix(request),
            ...requestOneLiner(request)
        )

        const platform = request.headers["x-platform"];
        const version = request.getVersion()
        if (version < 168) {
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
    },

    wrapRun<T>(run: () => Promise<T>, request: Request) {
        return logger.setContext({
            prefixes: requestPrefix(request, 'output'),
            tags: ['request', 'request-output']
        }, run)
    },

    handleResponse(request: Request, response: EncodedResponse, error?: Error) {
        const endTime = process.hrtime();
        const startTime = (request as any)._startTime ?? endTime;
        const timeInMs = Math.round((endTime[0] - startTime[0]) * 1000 + (endTime[1] - startTime[1]) / 1000000);

        const platform = request.headers["x-platform"];

        if (platform === "android" && STAMHOOFD.LATEST_ANDROID_VERSION) {
            response.headers["X-Platform-Latest-Version"] = STAMHOOFD.LATEST_ANDROID_VERSION
        }
        if (platform === "ios" && STAMHOOFD.LATEST_IOS_VERSION) {
            response.headers["X-Platform-Latest-Version"] = STAMHOOFD.LATEST_IOS_VERSION
        }
        if (platform === "web") {
            response.headers["X-Platform-Latest-Version"] = Version
        }   
        
        logger.log(
            ...requestPrefix(request, 'time'),
            "Finished in "+timeInMs+"ms"
        )

        if (error) {
            if (isSimpleError(error) || isSimpleErrors(error)) {
                if (!error.hasCode("expired_access_token")) {
                    logger.error(
                        ...requestPrefix(request, 'error'),
                        "Request with error in response ",
                        new StyledText(error).addClass('request', 'error')
                    )

                    logRequestDetails(request)
                }
            } else {
                logger.error(
                    ...requestPrefix(request, 'error'),
                    "Request with internal error ",
                    new StyledText(error).addClass('request', 'error')
                )

                logRequestDetails(request)
            }
        }
    }
}