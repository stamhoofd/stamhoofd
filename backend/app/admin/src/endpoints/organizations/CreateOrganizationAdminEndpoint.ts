import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, Token, User } from '@stamhoofd/models';
import {  NewUser, PermissionLevel, Permissions, Token as TokenStruct } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';

type Params = { id: string};
type Query = undefined;
type Body = NewUser;
type ResponseBody = TokenStruct;

export class CreateOrganizationAdminEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = NewUser as Decoder<NewUser>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations/@id/create-admin", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
       
        const organization = await Organization.getByID(request.params.id)
        if (!organization) {
            throw new SimpleError({
                code: "not_found",
                message: "Organization not found",
                statusCode: 404
            })
        }

        // Don't optimize. Always run two queries atm.
        const u = await User.getForRegister(organization, request.body.email)
        let user = await User.register(
            organization,
            request.body
        );

        if (!user) {
            if (u) {
                // Force change password
                u.permissions = Permissions.create({ level: PermissionLevel.Full })
                u.verified = true;
                await u.changePassword(request.body.password)
                await u.save()
                user = u
            } else {
                throw new SimpleError({
                    code: "user_creation_failed",
                    message: "Couldn't create user",
                    statusCode: 400
                })
            }
        } else {
            user.permissions = Permissions.create({ level: PermissionLevel.Full })
            user.verified = true;
            await user.save()
        }
        const token = await Token.createToken(user);
            
        if (!token) {
            throw new SimpleError({
                code: "error",
                message: "Could not generate token",
                human: "Er ging iets mis bij het aanmelden",
                statusCode: 500
            });
        }

        const st = new TokenStruct(token);
        return new Response(st);     
    }
}
