import { Request } from "@stamhoofd-backend/routing";
import { DecodedRequest } from "@stamhoofd-backend/routing";
import { Response } from "@stamhoofd-backend/routing";
import { Endpoint } from "@stamhoofd-backend/routing";

import { RegisterStruct } from "../structs/RegisterStruct";

type Params = {};
type Query = undefined;
type Body = RegisterStruct;
type ResponseBody = undefined;

export class CORSPreflightEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = RegisterStruct;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "OPTIONS") {
            return [false];
        }

        return [true, {}];
    }

    async handle(_request: DecodedRequest<Params, Query, Body>) {
        // todo: improve this and add organization level checking
        const response = new Response(undefined);
        response.headers["Access-Control-Allow-Origin"] = "*";
        response.headers["Access-Control-Allow-Methods"] = "*";
        response.headers["Access-Control-Max-Age"] = "86400"; // Cache 24h

        return Promise.resolve(response)
    }
}
