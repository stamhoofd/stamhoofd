import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { RegisterCode, Token, UsedRegisterCode } from '@stamhoofd/models';

type Params = Record<string, never>;
type Query = undefined;
type ResponseBody = undefined;

class Body extends AutoEncoder {
    @field({ decoder: StringDecoder })
    registerCode: string
}

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class ApplyRegisterCodeEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/register-code", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);    
        const user = token.user

        if (!user.isPlatformAdmin()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        let code = request.body.registerCode;

        if (code.startsWith('https:')) {
            try {
                const url = new URL(code);
                const codeParam = url.searchParams.get('code');
                if (codeParam) {
                    console.log('Parsed code from URL', codeParam)
                    code = codeParam;
                }
            } catch (e) {
                console.error('Tried parsing code as URL but failed', code)
            }
        }

        const {models, emails} = await RegisterCode.applyRegisterCode(user.organization, code)

        for (const model of models) {
            await model.save();
        }

        for (const email of emails) {
            Email.sendInternal(email, user.organization.i18n)
        }

        if (user.organization.meta.packages.isPaid) {
            // Already bought something: apply credit to other organization immediately
            const code = await UsedRegisterCode.getFor(user.organization.id)
            if (code && !code.creditId) {
                console.log("Rewarding code "+code.id+" for payment")

                // Deze code werd nog niet beloond
                await code.reward()
            }
        }

        return new Response(undefined);
    }
}

