import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors'
import { ForgotPasswordRequest } from '@stamhoofd/structures';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
import { Decoder } from '@simonbackx/simple-encoding';

import Email from '../email/Email';
import { Organization } from '../models/Organization';
import { PasswordToken } from '../models/PasswordToken';
import { User } from '../models/User';

// eslint-disable-next-line @typescript-eslint/ban-types
type Params = {};
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
        if (users.length == 0) {
            // Send email
            Email.sendInternal({
                to: request.body.email,
                subject: "["+organization.name+"] Wachtwoord vergeten",
                text: "Hallo, \n\nJe gaf aan dat je jouw wachtwoord bent vergeten, maar er bestaat geen account op het e-mailadres dat je hebt ingegeven ("+request.body.email+"). Niet zeker meer welk e-mailadres je kan gebruiken? Wij sturen altijd e-mails naar een e-mailadres waarop je een account hebt. Lukt dat niet? Dan moet je je eerst registreren.\n\nMet vriendelijke groeten,\n"+(organization.name)
            });

            return new Response(undefined)
        }
        const user = users[0].setRelation(User.organization, organization);
        const recoveryUrl = await PasswordToken.getPasswordRecoveryUrl(user)
        
        // Send email
        Email.sendInternal({
            to: user.email,
            subject: "Wachtwoord vergeten",
            text: (user.firstName ? "Hey "+user.firstName : "Hey") + ", \n\nJe gaf aan dat je jouw wachtwoord bent vergeten. Je kan een nieuw wachtwoord instellen door op de volgende link te klikken of door deze te kopiëren in de URL-balk van je browser:\n"+recoveryUrl+"\n\nWachtwoord al teruggevonden of heb je helemaal niet aangeduid dat je je wachtwoord vergeten bent? Dan mag je deze e-mail gewoon negeren.\n\nMet vriendelijke groeten,\n"+(user.permissions ? "Stamhoofd" : organization.name)
        });

        return new Response(undefined);
    }
}
