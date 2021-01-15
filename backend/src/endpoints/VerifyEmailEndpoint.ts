import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NewUser, SignupResponse, Token as TokenStruct, VerifyEmailRequest } from "@stamhoofd/structures";

import Email from '../email/Email';
import { EmailVerificationCode } from '../models/EmailVerificationCode';
import { Organization } from "../models/Organization";
import { Token } from '../models/Token';
import { User } from "../models/User";

type Params = {};
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

        const userId = await EmailVerificationCode.verify(organization.id, request.body.token, request.body.code)

        if (!userId) {
            throw new SimpleError({
                code: "invalid_code",
                message: "This code is invalid",
                human: "Deze code is ongeldig of vervallen. Probeer om opnieuw in te loggen om een nieuwe code te versturen",
                statusCode: 400
            })
        }

        const user = await User.getByID(userId)

        if (!user) {
            throw new SimpleError({
                code: "invalid_code",
                message: "This code is invalid",
                human: "Deze code is ongeldig of vervallen. Probeer om opnieuw in te loggen om een nieuwe code te versturen",
                statusCode: 400
            })
        }

        const token = await Token.createToken(user);
        const st = new TokenStruct(token);
        return new Response(st);
    }
}