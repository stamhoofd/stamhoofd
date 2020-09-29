import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { KeychainItemHelper } from '@stamhoofd/crypto';
import { NewUser,Token as TokenStruct } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { KeychainItem } from '../models/KeychainItem';
import { Organization } from "../models/Organization";
import { Token } from '../models/Token';
import { User } from "../models/User";

type Params = {};
type Query = undefined;
type Body = NewUser;
type ResponseBody = TokenStruct;

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

        //
        const user = await User.register(
            organization,
            request.body
        );

        if (!user) {
            // This user already exists, well that is pretty impossible
            // todo: report success + send an e-mail with message that you need to sign in
            throw new SimpleError({
                code: "creating_user",
                message: "Something went wrong while creating the user. Please contact us to resolve this issue.",
                human: "Er bestaat al een gebruiker met dit e-mailadres. Je kan inloggen met dit e-mailadres bij deze vereniging.",
                statusCode: 400
            });
        }

        // Create an expired access token, that you can only renew when the user has been verified, but this can keep the users signed in
        const token = await Token.createExpiredToken(user)

        // Send mail without waiting
        /*Email.send(user.email, "Verifieer jouw e-mailadres voor Stamhoofd", "Hey fa!\n\nWelkom bij Stamhoofd. Klik op de onderstaande link om jouw e-mailadres te bevestigen.\n\nStamhoofd").catch(e => {
            console.error(e)
        })*/

        // An email has been send to confirm your email address
        return new Response(new TokenStruct(token));
    }
}
