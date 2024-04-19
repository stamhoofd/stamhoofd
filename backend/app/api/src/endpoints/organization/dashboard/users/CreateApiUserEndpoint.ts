import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Token, User } from '@stamhoofd/models';
import { ApiUser, ApiUserWithToken } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';
type Params = Record<string, never>;
type Query = undefined;
type Body = ApiUser
type ResponseBody = ApiUser

export class CreateAdminEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = ApiUser as Decoder<ApiUser>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/api-keys", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManageAdmins()) {
            throw Context.auth.error()
        }

        const admin = new User();
        admin.organizationId = organization.id;
        admin.firstName = request.body.name;
        admin.lastName = null
        admin.email = 'creating.api'
        admin.verified = true

        if (!admin.isApiUser) {
            throw new Error('Unexpectedly created normal user while trying to create API-user')
        }

        // Merge permissions
        if (!request.body.permissions) {
            throw new SimpleError({
                code: 'missing_field',
                message: 'When creating API-users, you are required to specify permissions in the request',
                field: 'permissions'
            })
        }

        admin.permissions = request.body.permissions;
        await admin.save();

        // Set id
        admin.email = admin.id + '.api'
        await admin.save();

        const createdToken = await Token.createApiToken(admin);

        return new Response(ApiUserWithToken.create({
            ...(await Token.getAPIUserWithToken(admin)),
            token: createdToken.accessToken,
            expiresAt: createdToken.accessTokenValidUntil
        }));
    }
}
