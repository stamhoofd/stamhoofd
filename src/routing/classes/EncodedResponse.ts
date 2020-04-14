import { Encodeable } from "@/structs/classes/Encodeable";
import { Response } from "./Response";
import http from "http";

export class EncodedResponse {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: any;

    constructor(response: Response<Encodeable>) {
        this.status = response.status;
        this.headers = response.headers;
        this.body = JSON.stringify(response.body.encode());
    }
}
