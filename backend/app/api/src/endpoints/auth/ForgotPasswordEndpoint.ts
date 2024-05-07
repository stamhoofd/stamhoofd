import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Email } from '@stamhoofd/email';
import { PasswordToken, User } from '@stamhoofd/models';
import { ForgotPasswordRequest } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context';

// eslint-disable-next-line @typescript-eslint/ban-types
type Params = Record<string, never>;
type Query = undefined;
type Body = ForgotPasswordRequest;
type ResponseBody = undefined;

export class ForgotPasswordEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = ForgotPasswordRequest as Decoder<ForgotPasswordRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/forgot-password", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // for now we care more about UX, so we show a mesage if the user doesn't exist
        const organization = await Context.setOptionalOrganizationScope()
        const user = await User.getForAuthentication(organization?.id ?? null, request.body.email, {allowWithoutAccount: true});
        
        const { from, replyTo } = {
            from: organization ? organization.getStrongEmail(request.i18n) : Email.getInternalEmailFor(request.i18n),
            replyTo: undefined
        }
        const name = organization ? organization.name : STAMHOOFD.platformName

        if (!user) {
            // Send email
            Email.send({
                from,
                replyTo,
                to: request.body.email,
                subject: "["+name+"] Wachtwoord vergeten",
                type: "transactional",
                text: "Hallo, \n\nJe gaf aan dat je jouw wachtwoord bent vergeten, maar er bestaat geen account op het e-mailadres dat je hebt ingegeven ("+request.body.email+"). Niet zeker meer welk e-mailadres je kan gebruiken? Wij sturen altijd e-mails naar een e-mailadres waarop je een account hebt. Lukt dat niet? Dan moet je je eerst registreren.\n\nMet vriendelijke groeten,\n"+(name),
            });

            return new Response(undefined)
        }

        const recoveryUrl = await PasswordToken.getPasswordRecoveryUrl(user, organization, request.i18n)
        
        // Send email
        Email.send({
            from,
            replyTo,
            to: user.email,
            subject: "Wachtwoord vergeten",
            type: "transactional",
            text: (user.firstName ? "Hey "+user.firstName : "Hey") + ", \n\nJe gaf aan dat je jouw wachtwoord bent vergeten. Je kan een nieuw wachtwoord instellen door op de volgende link te klikken of door deze te kopiëren in de URL-balk van je browser:\n"+recoveryUrl+"\n\nWachtwoord al teruggevonden of heb je helemaal niet aangeduid dat je je wachtwoord vergeten bent? Dan mag je deze e-mail gewoon negeren.\n\nMet vriendelijke groeten,\n"+(user.permissions ? STAMHOOFD.platformName : name)
        });

        return new Response(undefined);
    }
}
