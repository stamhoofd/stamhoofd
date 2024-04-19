import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Email } from '@stamhoofd/email';
import { PasswordToken, User } from '@stamhoofd/models';
import { User as UserStruct } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { Context } from '../../../../helpers/Context';
type Params = Record<string, never>;
type Query = undefined;
type Body = UserStruct
type ResponseBody = UserStruct

export class CreateAdminEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = UserStruct as Decoder<UserStruct>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManageAdmins()) {
            throw Context.auth.error()
        }

        // First check if a user exists with this email?
        const existing = await User.getForRegister(organization, request.body.email)

        const admin = existing ?? new User();
        admin.organizationId = organization.id;
        admin.firstName = request.body.firstName;
        admin.lastName = request.body.lastName;
        admin.email = request.body.email;

        // Merge permissions
        if (!request.body.permissions) {
            throw new SimpleError({
                code: 'missing_field',
                message: 'When creating administrators, you are required to specify permissions in the request',
                field: 'permissions'
            })
        }

        if (existing && existing.permissions) {
            existing.permissions.add(request.body.permissions);
        } else {
            admin.permissions = request.body.permissions;
        }

        await admin.save();

        const { from, replyTo } = {
            from: organization.getStrongEmail(request.i18n),
            replyTo: undefined
        }

        // Create a password token that is valid for 7 days
        const validUntil = new Date();
        validUntil.setTime(validUntil.getTime() + 7 * 24 * 3600 * 1000);

        const dateTime = Formatter.dateTime(validUntil)
        const recoveryUrl = await PasswordToken.getPasswordRecoveryUrl(admin, organization, request.i18n, validUntil)

        if (admin.hasAccount()) {
            const url = "https://"+(STAMHOOFD.domains.dashboard ?? "stamhoofd.app")+"/"+request.i18n.locale;

            Email.send({
                from,
                replyTo,
                to: admin.getEmailTo(),
                subject: "✉️ Beheerder van "+organization.name,
                type: "transactional",
                text: (admin.firstName ? "Dag "+admin.firstName : "Hallo") + `, \n\n${user.firstName ?? 'Iemand'} heeft je toegevoegd als beheerder van de vereniging ${organization.name} op Stamhoofd. Je kan inloggen met je bestaande account (${admin.email}) door te surfen naar:\n${url}\n\nDaar kan je jouw vereniging zoeken en aanklikken.\n\n----\n\nWeet je jouw wachtwoord niet meer? Dan kan je een nieuw wachtwoord instellen via de onderstaande link:\n`+recoveryUrl+"\n\nDeze link is geldig tot "+dateTime+".\n\nKen je deze vereniging niet? Dan kan je deze e-mail veilig negeren.\n\nMet vriendelijke groeten,\nStamhoofd\n\n"+(STAMHOOFD.domains.marketing[organization.address.country] ?? "")
            });
        } else {
            // Send email
            Email.send({
                from,
                replyTo,
                to: admin.getEmailTo(),
                subject: "✉️ Uitnodiging beheerder van "+organization.name,
                type: "transactional",
                text: (admin.firstName ? "Dag "+admin.firstName : "Hallo") + `, \n\n${user.firstName ?? 'Iemand'} heeft je uitgenodigd om beheerder te worden van de vereniging ${organization.name} op Stamhoofd. Je kan een account aanmaken door op de volgende link te klikken of door deze te kopiëren in de URL-balk van je browser:\n`+recoveryUrl+"\n\nDeze link is geldig tot "+dateTime+".\n\nKen je deze vereniging niet? Dan kan je deze e-mail veilig negeren.\n\nMet vriendelijke groeten,\nStamhoofd\n\n"+(STAMHOOFD.domains.marketing[organization.address.country] ?? "")
            });
        }

        return new Response(UserStruct.create({...admin, hasAccount: admin.hasAccount()}));
    }
}
