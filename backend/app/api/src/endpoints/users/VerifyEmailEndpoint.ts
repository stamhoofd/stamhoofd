import { Database } from '@simonbackx/simple-database';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Email, EmailInterface, EmailInterfaceBase } from '@stamhoofd/email';
import { EmailVerificationCode, Member } from '@stamhoofd/models';
import { Organization } from "@stamhoofd/models";
import { Token } from '@stamhoofd/models';
import { User } from "@stamhoofd/models";
import { Token as TokenStruct, VerifyEmailRequest } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Query = undefined;
type Body = VerifyEmailRequest;
type ResponseBody = TokenStruct;

export class VerifyEmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = VerifyEmailRequest as Decoder<VerifyEmailRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/verify-email", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Organization.fromApiHost(request.host);

        const code = await EmailVerificationCode.verify(organization.id, request.body.token, request.body.code)

        if (!code) {
            throw new SimpleError({
                code: "invalid_code",
                message: "This code is invalid",
                human: "Deze code is ongeldig of vervallen.",
                statusCode: 400
            })
        }

        const user = await User.getByID(code.userId)

        if (!user) {
            throw new SimpleError({
                code: "invalid_code",
                message: "This code is invalid",
                human: "Deze code is ongeldig of vervallen.",
                statusCode: 400
            })
        }

        if (user.email != code.email) {
            const other = await User.getForRegister(organization, code.email)

            if (other) {
                // Delete the other user, but merge data
                await user.merge(other);
            }
            
            // change user email
            user.email = code.email

            // If already in use: will fail, so will verification
        }

        user.verified = true

        try {
            await user.save()
        } catch (e) {
            // Duplicate key probably
            if (e.code && e.code == "ER_DUP_ENTRY") {
                throw new SimpleError({
                    code: "email_in_use",
                    message: "This e-mail is already in use, we cannot set it",
                    human: "We kunnen het e-mailadres van deze gebruiker niet instellen naar "+code.email+", omdat die al in gebruik is. Waarschijnlijk heb je meerdere accounts. Probeer met dat e-mailadres in te loggen of contacteer ons ("+request.$t("shared.emails.general")+") als we de gebruikers moeten combineren tot één gebruiker."
                })
            }
            throw e;
        }

        const token = await Token.createToken(user);
        const st = new TokenStruct(token);
        return new Response(st);
    }
}