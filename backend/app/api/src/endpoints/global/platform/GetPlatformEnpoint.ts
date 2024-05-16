import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Platform } from "@stamhoofd/models";
import { Platform as PlatformStruct } from "@stamhoofd/structures";

import { Context } from "../../../helpers/Context";

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = PlatformStruct;

export class GetPlatformEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/platform", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.optionalAuthenticate({allowWithoutAccount: false})

        if (Context.optionalAuth?.hasSomePlatformAccess()) {
            const platform = await Platform.getSharedPrivateStruct()
            if (!platform.privateConfig) {
                throw new Error("Private config not found")
            }
            return new Response(platform);
        }
        const platform = await Platform.getSharedStruct()
        return new Response(platform);
    }
}
