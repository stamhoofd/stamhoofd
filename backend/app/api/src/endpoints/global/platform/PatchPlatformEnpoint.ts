import { AutoEncoderPatchType, Decoder, patchObject } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Platform } from "@stamhoofd/models";
import { Platform as PlatformStruct } from "@stamhoofd/structures";

import { Context } from "../../../helpers/Context";

type Params = Record<string, never>;
type Query = undefined;
type Body = AutoEncoderPatchType<PlatformStruct>;
type ResponseBody = PlatformStruct;

export class PatchPlatformEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PlatformStruct.patchType() as Decoder<AutoEncoderPatchType<PlatformStruct>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/platform", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error()
        }

        const platform = await Platform.getShared()

        if (request.body.privateConfig) {
            // Did we patch roles?
            if (request.body.privateConfig.roles) {
                if (!Context.auth.canManagePlatformAdmins()) {
                    throw Context.auth.error()
                }

                // Update roles
                platform.privateConfig.roles = patchObject(platform.privateConfig.roles, request.body.privateConfig.roles)
            }
        }

        await platform.save()
        return new Response(await Platform.getSharedPrivateStruct());
    }
}
