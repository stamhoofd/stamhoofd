import http from "http";

export class Response<Body> {
    headers: http.OutgoingHttpHeaders = {};
    body: Body;

    constructor(body: Body) {
        this.body = body;
    }
}
