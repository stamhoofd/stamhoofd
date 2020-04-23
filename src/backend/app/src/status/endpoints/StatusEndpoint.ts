import { Request } from "@stamhoofd-backend/routing";
import { DecodedRequest } from "@stamhoofd-backend/routing";
import { Response } from "@stamhoofd-backend/routing";
import { Endpoint } from "@stamhoofd-backend/routing";
import { Encodeable } from '@stamhoofd-common/encoding';

class StatusStruct implements Encodeable {
    status: string;
    time: number

    constructor(status: string) {
        this.status = status;
        this.time = Math.round((new Date().getTime())/1000)
    }

    encode() {
        return this;
    }

}

type Params = {};
type Query = undefined;
type Body = undefined;
type ResponseBody = StatusStruct;

export class CreateTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/status", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    handle(_request: DecodedRequest<Params, Query, Body>) {
        const st = new StatusStruct("ready");
        return Promise.resolve(new Response(st));
    }
}
