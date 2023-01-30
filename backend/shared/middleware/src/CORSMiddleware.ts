import { EncodedResponse, Request, ResponseMiddleware } from "@simonbackx/simple-endpoints";

export const CORSMiddleware: ResponseMiddleware = {
    handleResponse(request: Request, response: EncodedResponse) {
        response.headers["Access-Control-Allow-Origin"] = request.headers.origin ?? "*"
        response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS, PATCH, PUT, DELETE"
        response.headers["Access-Control-Allow-Headers"] = request.headers["access-control-request-headers"] ?? "*";
        response.headers["Access-Control-Max-Age"] = "86400"; // Cache 24h
        
        if (request.method !== "OPTIONS") {
            response.headers["Access-Control-Expose-Headers"] = "X-Platform-Latest-Version"
        }
        
        // Not needed
        // response.headers["Access-Control-Allow-Credentials"] = "true";

        // API is public
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"

        if (request.headers.origin && !response.headers["Vary"]) {
            response.headers["Vary"] = "Origin"
        }
    }
}