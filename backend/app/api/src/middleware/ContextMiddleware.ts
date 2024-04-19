import { Request, RequestMiddleware } from "@simonbackx/simple-endpoints"

import { ContextInstance } from "../helpers/Context"

/**
 * This attaches a context to each request for authentication and authorization
 */
export const ContextMiddleware: RequestMiddleware = {
    wrapRun<T>(run: () => Promise<T>, request: Request) {
        return ContextInstance.start(request, run)
    },

    handleRequest: function (request: Request) {
        // Noop
    }
}