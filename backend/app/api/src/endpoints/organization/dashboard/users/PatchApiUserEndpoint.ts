import { AutoEncoderPatchType, Decoder, isPatch } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Token, User } from '@stamhoofd/models';
import { ApiUser, PermissionLevel, UserMeta, UserPermissions } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context.js';

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<ApiUser>;
type ResponseBody = ApiUser;

export class PatchApiUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = ApiUser.patchType() as Decoder<AutoEncoderPatchType<ApiUser>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/api-keys/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        if (request.body.id !== request.params.id) {
            throw new SimpleError({
                code: 'invalid_request',
                message: 'Invalid request: id mismatch',
                statusCode: 400,
            });
        }

        const editUser = request.body.id === user.id ? user : await User.getByID(request.body.id);

        if (!editUser || !await Context.auth.canAccessUser(editUser, PermissionLevel.Write) || !editUser.isApiUser) {
            throw Context.auth.notFoundOrNoAccess($t(`cd099f48-7a5e-4993-854d-697104201871`));
        }

        editUser.firstName = request.body.name ?? editUser.name;
        editUser.lastName = null;

        if (request.body.permissions !== undefined && editUser.permissions) {
            if (!await Context.auth.canAccessUser(editUser, PermissionLevel.Full)) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Je hebt geen rechten om de rechten van deze API-user te wijzigen',
                });
            }

            if (request.body.permissions) {
                if (organization) {
                    editUser.permissions = UserPermissions.limitedPatch(editUser.permissions, request.body.permissions, organization.id);

                    if (editUser.id === user.id && (!editUser.permissions || !editUser.permissions.forOrganization(organization)?.hasFullAccess())) {
                        throw new SimpleError({
                            code: 'permission_denied',
                            message: 'Je kan jezelf niet verwijderen als hoofdbeheerder',
                        });
                    }
                }
                else {
                    if (editUser.permissions) {
                        editUser.permissions.patchOrPut(request.body.permissions);
                    }
                    else {
                        editUser.permissions = request.body.permissions.isPut() ? request.body.permissions : null;
                    }

                    if (editUser.id === user.id && !editUser.permissions?.platform?.hasFullAccess()) {
                        throw new SimpleError({
                            code: 'permission_denied',
                            message: 'Je kan jezelf niet verwijderen als hoofdbeheerder',
                        });
                    }
                }
            }
        }

        if (request.body.meta) {
            if (!isPatch(request.body.meta)) {
                throw new SimpleError({
                    code: 'invalid_request',
                    message: 'Invalid request: meta is not a patch',
                    statusCode: 400,
                });
            }

            const rateLimits = request.body.meta.rateLimits;
            if (rateLimits && rateLimits !== editUser.meta?.rateLimits) {
                if (!Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error($t('370932fc-6614-44be-bb8f-ff921305fadd'));
                }

                editUser.meta = editUser.meta ?? UserMeta.create({});
                editUser.meta.rateLimits = rateLimits;
            }
        }

        await editUser.save();

        return new Response(await Token.getAPIUserWithToken(editUser));
    }
}
