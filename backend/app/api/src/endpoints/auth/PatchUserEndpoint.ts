import { AutoEncoderPatchType, Decoder, isPatch } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, Member, PasswordToken, Platform, Token, User } from '@stamhoofd/models';
import { LoginMethod, NewUser, PermissionLevel, SignupResponse, UserPermissions, UserWithMembers } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context';
import { MemberUserSyncer } from '../../helpers/MemberUserSyncer';
import { AuthenticatedStructures } from '../../helpers/AuthenticatedStructures';

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<NewUser>;
type ResponseBody = UserWithMembers;

export class PatchUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = NewUser.patchType() as Decoder<AutoEncoderPatchType<NewUser>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user, token } = await Context.authenticate({ allowWithoutAccount: true });

        if (request.body.id !== request.params.id) {
            throw new SimpleError({
                code: 'invalid_request',
                message: 'Invalid request: id mismatch',
                statusCode: 400,
            });
        }

        const editUser = request.body.id === user.id ? user : await User.getByID(request.body.id);

        if (!editUser || !await Context.auth.canAccessUser(editUser, PermissionLevel.Write) || editUser.isApiUser) {
            throw Context.auth.notFoundOrNoAccess('Je hebt geen toegang om deze gebruiker te wijzigen');
        }

        if (await Context.auth.canEditUserName(editUser)) {
            if (editUser.memberId) {
                const member = await Member.getWithRegistrations(editUser.memberId);
                if (member) {
                    member.details.firstName = request.body.firstName ?? member.details.firstName;
                    member.details.lastName = request.body.lastName ?? member.details.lastName;

                    editUser.firstName = member.details.firstName;
                    editUser.lastName = member.details.lastName;
                    await member.save();

                    // Also propage the name change to other users of the same member if needed
                    await MemberUserSyncer.onChangeMember(member);
                }
            }
            else {
                editUser.firstName = request.body.firstName ?? editUser.firstName;
                editUser.lastName = request.body.lastName ?? editUser.lastName;
            }
        }

        if (request.body.permissions !== undefined) {
            if (!await Context.auth.canAccessUser(editUser, PermissionLevel.Full)) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Je hebt geen rechten om de rechten van deze gebruiker te wijzigen',
                });
            }

            if (request.body.permissions) {
                if (organization) {
                    editUser.permissions = UserPermissions.limitedPatch(editUser.permissions, request.body.permissions, organization.id);

                    if (editUser.id === user.id && (!editUser.permissions || !editUser.permissions.forOrganization(organization)?.hasFullAccess()) && STAMHOOFD.environment !== 'development') {
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

                    if (editUser.permissions && editUser.permissions.isEmpty) {
                        editUser.permissions = null;
                    }

                    if (editUser.id === user.id && !editUser.permissions?.platform?.hasFullAccess() && STAMHOOFD.environment !== 'development') {
                        throw new SimpleError({
                            code: 'permission_denied',
                            message: 'Je kan jezelf niet verwijderen als hoofdbeheerder',
                        });
                    }
                }
            }
        }

        if (request.body.meta) {
            if (request.body.meta.loginProviderIds && isPatch(request.body.meta.loginProviderIds)) {
                // Delete deleted login providers
                for (const [key, value] of request.body.meta.loginProviderIds) {
                    if (value !== null) {
                        // Not allowed
                        throw Context.auth.error('You are not allowed to change the login provider ids');
                    }

                    if (editUser.meta?.loginProviderIds.has(key)) {
                        // Check has remaining method
                        if (editUser.meta.loginProviderIds.size <= 1 && !editUser.hasPasswordBasedAccount()) {
                            throw new SimpleError({
                                code: 'invalid_request',
                                message: 'You cannot remove the last login provider',
                                human: 'Stel eerst een wachtwoord in voor jouw account voor je deze loginmethode uitschakelt.',
                                statusCode: 400,
                            });
                        }
                        editUser.meta.loginProviderIds.delete(key);
                    }
                }
            }
        }

        if (editUser.id === user.id && request.body.password) {
            if (STAMHOOFD.userMode === 'platform') {
                const platform = await Platform.getSharedPrivateStruct();
                const config = platform.config.loginMethods.get(LoginMethod.Password);
                if (!config) {
                    throw new SimpleError({
                        code: 'not_supported',
                        message: 'This platform does not support password login',
                        human: 'Dit platform ondersteunt geen wachtwoord login',
                        statusCode: 400,
                    });
                }

                if (!config.isEnabledForEmail(editUser.email)) {
                    throw new SimpleError({
                        code: 'not_supported',
                        message: 'Login method not supported',
                        human: 'Je kan op dit account geen wachtwoord gebruiken om in te loggen.',
                        statusCode: 400,
                    });
                }
            }

            // password changes
            await editUser.changePassword(request.body.password);
            await PasswordToken.clearFor(editUser.id);
            await Token.clearFor(editUser.id, token.accessToken);
        }

        if (request.body.hasPassword === false) {
            if (editUser.hasPasswordBasedAccount()) {
                // Check other login methods available
                if (!editUser.meta?.loginProviderIds?.size) {
                    throw new SimpleError({
                        code: 'invalid_request',
                        message: 'You cannot remove the last login provider',
                        human: 'Je kan jouw wachtwoord niet verwijderen als je geen andere loginmethode hebt.',
                        statusCode: 400,
                    });
                }
                editUser.password = null;
                await PasswordToken.clearFor(editUser.id);
                await Token.clearFor(editUser.id, token.accessToken);
            }
        }

        await editUser.save();

        if (await Context.auth.canEditUserEmail(editUser)) {
            if (request.body.email && request.body.email !== editUser.email) {
                // Create an validation code
                // We always need the code, to return it. Also on password recovery -> may not be visible to the client whether the user exists or not
                const code = await EmailVerificationCode.createFor(editUser, request.body.email);
                code.send(editUser, organization, request.i18n, editUser.id === user.id).catch(console.error);

                throw new SimpleError({
                    code: 'verify_email',
                    message: 'Your email address needs verification',
                    human: editUser.id === user.id ? 'Verifieer jouw nieuwe e-mailadres via de link in de e-mail, daarna passen we het automatisch aan.' : 'Er is een verificatie e-mail verstuurd naar ' + request.body.email + ' om het e-mailadres te verifiëren. Zodra dat is gebeurd, wordt het e-mailadres gewijzigd.',
                    meta: SignupResponse.create({
                        token: code.token,
                    }).encode({ version: request.request.getVersion() }),
                    statusCode: 403,
                });
            }
        }

        return new Response(
            await AuthenticatedStructures.userWithMembers(editUser),
        );
    }
}
