import { Encodeable } from "@stamhoofd-common/encoding/src/classes/Encodeable";
import { Response } from "./Response";
import http from "http";

export class EncodedResponse {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: any;

    constructor(response: Response<Encodeable | undefined>) {
        this.status = response.status;
        this.headers = response.headers;

        if (response.body !== undefined) {
            this.body = JSON.stringify(response.body.encode());
        } else {
            this.body = "";
        }
    }
}
