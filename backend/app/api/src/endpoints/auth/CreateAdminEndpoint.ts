import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { PasswordToken, Platform, sendEmailTemplate, User } from '@stamhoofd/models';
import { EmailTemplateType, Recipient, Replacement, UserPermissions, User as UserStruct, UserWithMembers } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../helpers/AuthenticatedStructures.js';
import { Context } from '../../helpers/Context.js';
type Params = Record<string, never>;
type Query = undefined;
type Body = UserStruct;
type ResponseBody = UserWithMembers;

export class CreateAdminEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = UserStruct as Decoder<UserStruct>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (organization) {
            if (!await Context.auth.canManageAdmins(organization.id)) {
                throw Context.auth.error();
            }
        }
        else {
            // Fast throw first (more in depth checking for patches later)
            if (!Context.auth.canManagePlatformAdmins()) {
                throw Context.auth.error();
            }
        }

        // First check if a user exists with this email?
        const existing = await User.getForRegister(organization?.id ?? null, request.body.email);

        const admin = existing ?? (await User.createInvited(organization, {
            firstName: request.body.firstName,
            lastName: request.body.lastName,
            email: request.body.email,
            allowPlatform: true,
        }));

        if (!admin) {
            throw new SimpleError({
                code: 'internal_error',
                message: 'Something went wrong while creating the admin',
                human: $t(`f298a54a-ee0f-462c-a80a-8d8c967dfda3`),
                statusCode: 500,
            });
        }

        // Merge permissions
        if (!request.body.permissions) {
            throw new SimpleError({
                code: 'missing_field',
                message: 'When creating administrators, you are required to specify permissions in the request',
                field: 'permissions',
            });
        }

        if (organization) {
            admin.permissions = UserPermissions.limitedAdd(admin.permissions, request.body.permissions, organization.id);
        }
        else {
            admin.permissions = UserPermissions.add(admin.permissions, request.body.permissions);
        }

        if (!admin.firstName && request.body.firstName) {
            // Allow setting the name if the user didn't had a name yet
            admin.firstName = request.body.firstName;
        }

        if (!admin.lastName && request.body.lastName) {
            // Allow setting the name if the user didn't had a name yet
            admin.lastName = request.body.lastName;
        }

        await admin.save();

        // Create a password token that is valid for 7 days
        const validUntil = new Date();
        validUntil.setTime(validUntil.getTime() + 7 * 24 * 3600 * 1000);

        const dateTime = Formatter.dateTime(validUntil);
        const recoveryUrl = await PasswordToken.getPasswordRecoveryUrl(admin, organization, request.i18n, validUntil);
        const platformName = ((await Platform.getSharedStruct()).config.name);

        const name = organization?.name ?? platformName;
        const what = organization ? $t('a5c0dce2-01df-4a57-8d02-0b79cec9b89d', { name, platform: platformName }) : platformName;

        const emailTo = admin.getEmailTo();
        const email: string = typeof emailTo === 'string' ? emailTo : emailTo[0]?.email;

        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({
                    firstName: admin.firstName,
                    lastName: admin.lastName,
                    email,
                    replacements: [
                        Replacement.create({
                            token: 'resetUrl',
                            value: recoveryUrl,
                        }),
                        Replacement.create({
                            token: 'platformOrOrganizationName',
                            value: what,
                        }),
                        Replacement.create({
                            token: 'inviterName',
                            value: user.firstName ?? $t(`afc47996-7028-43ad-b7d0-8b5bb2979883`),
                        }),
                        Replacement.create({
                            token: 'validUntil',
                            value: dateTime,
                        }),
                    ],
                }),
            ],
            template: {
                type: admin.hasAccount() ? EmailTemplateType.AdminInvitation : EmailTemplateType.AdminInvitationNewUser,
            },
            type: 'transactional',
        });

        return new Response(
            await AuthenticatedStructures.userWithMembers(admin),
        );
    }
}
