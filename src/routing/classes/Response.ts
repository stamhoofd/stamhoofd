interface Headers {
    [key: string]: string;
}
export class Response<Body> {
    headers: Headers = {}
    body: Body

    constructor(body: Body) {
        this.body = body
    }
}
