import { AutoEncoderPatchType, Decoder, patchObject } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Platform, RegistrationPeriod } from "@stamhoofd/models";
import { Platform as PlatformStruct } from "@stamhoofd/structures";

import { Context } from "../../../helpers/Context";
import { SimpleError } from "@simonbackx/simple-errors";

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

        if (request.body.config) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error()
            }

            // Update config
            platform.config = patchObject(platform.config, request.body.config)
        }

        if (request.body.period && request.body.period.id !== platform.periodId) {
            const period = await RegistrationPeriod.getByID(request.body.period.id)
            if (!period || period.organizationId) {
                throw new SimpleError({
                    code: "invalid_period",
                    message: "Invalid period"
                })
            }
            platform.periodId = period.id
        }

        await platform.save()
        return new Response(await Platform.getSharedPrivateStruct());
    }
}
