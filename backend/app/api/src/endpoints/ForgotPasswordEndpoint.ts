import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { Email } from '@stamhoofd/email';
import { Organization } from '@stamhoofd/models';
import { PasswordToken } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
import { ForgotPasswordRequest } from '@stamhoofd/structures';

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
        const organization = await Organization.fromApiHost(request.host);
        const users = await User.where({ email: request.body.email, organizationId: organization.id }, { limit: 1 })
        const { from, replyTo } = {
            from: organization.getStrongEmail(request.i18n),
            replyTo: undefined
        }

        if (users.length == 0 || !users[0].hasAccount()) {
            // Send email
            Email.send({
                from,
                replyTo,
                to: request.body.email,
                subject: "["+organization.name+"] Wachtwoord vergeten",
                type: "transactional",
                text: "Hallo, \n\nJe gaf aan dat je jouw wachtwoord bent vergeten, maar er bestaat geen account op het e-mailadres dat je hebt ingegeven ("+request.body.email+"). Niet zeker meer welk e-mailadres je kan gebruiken? Wij sturen altijd e-mails naar een e-mailadres waarop je een account hebt. Lukt dat niet? Dan moet je je eerst registreren.\n\nMet vriendelijke groeten,\n"+(organization.name),
            });

            return new Response(undefined)
        }
        const user = users[0].setRelation(User.organization, organization);
        const recoveryUrl = await PasswordToken.getPasswordRecoveryUrl(user, request.i18n)
        
        // Send email
        Email.send({
            from,
            replyTo,
            to: user.email,
            subject: "Wachtwoord vergeten",
            type: "transactional",
            text: (user.firstName ? "Hey "+user.firstName : "Hey") + ", \n\nJe gaf aan dat je jouw wachtwoord bent vergeten. Je kan een nieuw wachtwoord instellen door op de volgende link te klikken of door deze te kopiëren in de URL-balk van je browser:\n"+recoveryUrl+"\n\nWachtwoord al teruggevonden of heb je helemaal niet aangeduid dat je je wachtwoord vergeten bent? Dan mag je deze e-mail gewoon negeren.\n\nMet vriendelijke groeten,\n"+(user.permissions ? "Stamhoofd" : organization.name)
        });

        return new Response(undefined);
    }
}
