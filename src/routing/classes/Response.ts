import http from "http";

export class Response<Body> {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: Body;

    constructor(body: Body) {
        this.body = body;
    }
}
