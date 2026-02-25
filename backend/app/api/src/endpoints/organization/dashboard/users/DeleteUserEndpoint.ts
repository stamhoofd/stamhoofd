import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { User } from '@stamhoofd/models';

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

        if (user.id == request.params.id) {
            throw new SimpleError({
                code: 'permission_denied',
                message: $t(`253f8a6e-bef8-4a3a-8a7c-2580d8bad49c`),
            });
        }

        const editUser = await User.getByID(request.params.id);
        if (!editUser || !Context.auth.checkScope(editUser.organizationId)) {
            throw new SimpleError({
                code: 'permission_denied',
                message: $t(`dd63dfe1-1a13-476b-b729-10b9df944e88`),
            });
        }

        await editUser.delete();

        return new Response(undefined);
    }
}
