import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { PatchMap } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { User } from '@stamhoofd/models';
import { PermissionLevel, UserPermissions } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

export class DeleteUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'DELETE') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }

        const params2 = Endpoint.parseParameters(request.url, '/api-keys/@id', { id: String });

        if (params2) {
            return [true, params2 as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.canManageAdmins(organization.id)) {
            throw Context.auth.error();
        }

        if (user.id === request.params.id) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'You cannot delete your own account',
                human: $t(`%FE`),
            });
        }

        const editUser = await User.getByID(request.params.id);
        if (!editUser || !Context.auth.checkScope(editUser.organizationId)) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'User not found or no access',
                human: $t(`%FF`),
            });
        }

        if (editUser.isApiUser) {
            // API keys belong to the organization that created them
            if (editUser.organizationId !== organization.id) {
                throw Context.auth.error();
            }

            await editUser.delete();
            return new Response(undefined);
        }

        if (!await Context.auth.canAccessUser(editUser, PermissionLevel.Full)) {
            throw Context.auth.error();
        }

        if (editUser.organizationId !== organization.id) {
            // A platform-level account is not owned by this organization: only revoke its permissions here
            editUser.permissions = UserPermissions.limitedPatch(editUser.permissions, UserPermissions.patch({
                organizationPermissions: new PatchMap([[organization.id, null]]),
            }), organization.id);
            await editUser.save();
            return new Response(undefined);
        }

        await editUser.delete();

        return new Response(undefined);
    }
}
