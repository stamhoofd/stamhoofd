import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NewUser, SignupResponse } from "@stamhoofd/structures";

import Email from '../email/Email';
import { EmailVerificationCode } from '../models/EmailVerificationCode';
import { Organization } from "../models/Organization";
import { PasswordToken } from '../models/PasswordToken';
import { User } from "../models/User";

type Params = {};
type Query = undefined;
type Body = NewUser;
type ResponseBody = SignupResponse;

export class SignupEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = NewUser as Decoder<NewUser>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/sign-up", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Organization.fromApiHost(request.host);

         if (request.request.getVersion() < 52) { 
            // this allows a user enumeration attack, but we will support this for a couple of days
            // because we need this fallback for older clients
            // Automatically disabled after 15th February 2021

            throw new SimpleErrors(
                new SimpleError({
                    code: "outdated_client",
                    message: "Client is out of date.",
                    human: "Er is ondertussen een nieuwe versie beschikbaar van onze inschrijvingspagina. Herlaad de pagina en wis indien nodig je browsercache. ",
                    statusCode: 400
                })
            );
        }

        const u = await User.getForRegister(organization, request.body.email)

        // Don't optimize. Always run two queries atm.
        let user = await User.register(
            organization,
            request.body
        );

        let sendCode = true

        if (!user) {
            if (!u) {
                // Fail silently because user did exist, and we don't want to expose that the user doesn't exists
                console.error("Could not register, but user doesn't exist: "+request.body.email)

                throw new SimpleError({
                    code: "unexpected_error",
                    message: "Something went wrong",
                    human: "Er ging iets mis",
                    statusCode: 500
                })
            }

            user = u

            if (u.hasAccount()) {
                // Send an e-mail to say you already have an account + follow password forgot flow
                const recoveryUrl = await PasswordToken.getPasswordRecoveryUrl(user)
                const { from, replyTo } = organization.getDefaultEmail()
                
                // Send email
                Email.send({
                    from,
                    replyTo,
                    to: user.email,
                    subject: `[${organization.name}] Je hebt al een account`,
                    text: (user.firstName ? "Hey "+user.firstName : "Hey") + ", \n\nJe probeerde een account aan te maken, maar je hebt eigenlijk al een account met e-mailadres "+user.email+". Als je jouw wachtwoord niet meer weet, kan je een nieuw wachtwoord instellen door op de volgende link te klikken of door deze te kopiëren in de adresbalk van jouw browser:\n"+recoveryUrl+"\n\nWachtwoord al teruggevonden of heb je helemaal niet proberen te registreren? Dan mag je deze e-mail veilig negeren.\n\nMet vriendelijke groeten,\n"+(user.permissions ? "Stamhoofd" : organization.name)
                });

                // Don't send the code
                sendCode = false
            } else {
                // This is safe, because we are the first one. There is no password yet.
                // If a hacker tries this, he won't be able to sign in, because he needs to
                // verify the e-mail first (same as if the user didn't exist)
                // If we didn't set the password, we would allow a different kind of attack:
                // a hacker could send an e-mail to the user (try to register again, seindgin a new email which would trigger a different password change), right after the user registered (without verifying yet), when he had set a different password
                // user clicks on second e-mail -> this sets the hackers password instead 
                user.verified = false
                await user.changePassword(request.body)
                await user.save()
            }
        }

        // We always need the code, to return it. Also on password recovery -> may not be visible to the client whether the user exists or not
        const code = await EmailVerificationCode.createFor(user, user.email)

        if (sendCode) {
            code.send(user)
        }

        return new Response(SignupResponse.create({
            token: code.token,

            // To avoid user enumeration attack, always return the same encryption constants
            authEncryptionKeyConstants: request.body.authEncryptionKeyConstants
        }));
    }
}