import { Encodeable } from '@stamhoofd-common/encoding';
import http from "http";

import { Response } from "./Response";

export class EncodedResponse {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: any;

    constructor(response: Response<Encodeable | undefined>) {
        this.status = response.status;
        this.headers = response.headers;

        if (response.body !== undefined) {
            if (!this.headers['Content-Type']) {
                this.headers["Content-Type"] = "application/json";
            }
            this.body = JSON.stringify(response.body.encode());
        } else {
            this.body = "";
        }
    }
}
