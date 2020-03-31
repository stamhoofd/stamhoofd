import { Encodeable } from "../../structs/classes/Encodeable";
import { Response } from "./Response";
import http from "http";

export class EncodedResponse {
    headers: http.OutgoingHttpHeaders = {};
    body: any;

    constructor(response: Response<Encodeable>) {
        this.headers = response.headers;
        this.body = JSON.stringify(response.body.encode());
    }
}
