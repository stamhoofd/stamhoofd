interface Headers {
    [key: string]: string;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"
export class Request {
    method: HttpMethod
    url: string
    body: string

    headers: Headers = {}
    params: {} = {}
    query: {} = {}

    static buildJson(method: HttpMethod, url: string, body?: any): Request {
        const r = new Request()
        r.method = method
        r.url = url
        r.body = JSON.stringify(body) || ""
        return r
    }
}
