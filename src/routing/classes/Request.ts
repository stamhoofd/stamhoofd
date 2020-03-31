import http from "http";
import url from "url";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
export class Request {
    method: HttpMethod;
    url: string;
    body: Promise<string>;

    headers: http.IncomingHttpHeaders;
    query: {} = {};

    constructor(req: {
        method: HttpMethod;
        url: string;
        headers?: http.IncomingHttpHeaders;
        body?: Promise<string>;
        query?: {};
    }) {
        this.method = req.method;
        this.url = req.url;
        this.headers = req.headers ?? {};
        this.body = req.body ?? Promise.resolve("");
    }

    static buildJson(method: HttpMethod, url: string, body?: any): Request {
        return new Request({
            method: method,
            url: url,
            body: Promise.resolve(JSON.stringify(body) || "")
        });
    }

    static fromHttp(req: http.IncomingMessage): Request {
        if (!req.url) {
            throw new Error("Something went wrong");
        }
        const body = new Promise<string>((resolve, reject) => {
            console.log("Started listining for data");
            const chunks: any[] = [];
            let gotError = false;

            // we can access HTTP headers
            req.on("data", chunk => {
                console.log(`Data chunk available: ${chunk}`);
                chunks.push(chunk);
            });
            req.on("error", err => {
                gotError = true;
                reject(err);
            });

            req.on("end", () => {
                if (gotError) {
                    return;
                }
                console.log("Received full body");
                const body = Buffer.concat(chunks).toString();
                resolve(body);
            });
        });

        const parsedUrl = url.parse(req.url, true);
        return new Request({
            method: req.method as HttpMethod,
            url: parsedUrl.pathname ?? "",
            query: parsedUrl.query,
            body: body
        });
    }
}
