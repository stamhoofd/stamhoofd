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
        await sleep(1000);

        const organization = await Organization.fromApiHost(request.host);
        const users = await User.where({ email: request.body.email, organizationId: organization.id }, { limit: 1 })
        if (users.length == 0) {
            throw new SimpleError({
                code: "user_not_found",
                message: "This user does not exist",
                human: "Er bestaat geen gebruiker met dit e-mailadres",
            })
        }
        const user = users[0];

        const token = await PasswordToken.createToken(user)

        let host: string;
        if (user.permissions) {
            host = "https://"+(process.env.HOSTNAME_DASHBOARD ?? "stamhoofd.app")
        } else {
            host = "https://"+organization.getHost()
        }

        const recoveryUrl = host+"/reset-password"+(user.permissions ? "/"+encodeURIComponent(organization.id) : "")+"?token="+encodeURIComponent(token.token);

        // todo: use e-mail of organization
        
        // Send email
        Email.sendInternal({
            to: user.email,
            subject: "Wachtwoord vergeten",
            text: (user.firstName ? "Hey "+user.firstName : "Hey") + ", \n\nJe gaf aan dat je jouw wachtwoord bent vergeten. Je kan een nieuw wachtwoord instellen door op de volgende link te klikken of door deze te kopieëren in de URL-balk van je browser:\n"+recoveryUrl+"\n\nWachtwoord al teruggevonden of heb je helemaal niet aangeduid dat je je wachtwoord vergeten bent? Dan mag je deze e-mail gewoon negeren.\n\nMet vriendelijke groeten,\n"+(user.permissions ? "Stamhoofd" : organization.name)
        });

        return new Response(undefined);
    }
}
