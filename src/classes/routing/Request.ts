interface Headers {
    [key: string]: string;
}
export class Request {
    headers: Headers = {}
    body: string
    params: {} = {}
    query: {} = {}
}
