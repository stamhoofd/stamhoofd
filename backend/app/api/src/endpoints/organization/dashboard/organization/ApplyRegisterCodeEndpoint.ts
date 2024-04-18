import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Email } from '@stamhoofd/email';
import { RegisterCode, UsedRegisterCode } from '@stamhoofd/models';

import { Context } from '../../../../helpers/Context';

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
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error()
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

        const {models, emails} = await RegisterCode.applyRegisterCode(organization, code)

        for (const model of models) {
            await model.save();
        }

        for (const email of emails) {
            Email.sendInternal(email, organization.i18n)
        }

        if (organization.meta.packages.isPaid) {
            // Already bought something: apply credit to other organization immediately
            const code = await UsedRegisterCode.getFor(organization.id)
            if (code && !code.creditId) {
                console.log("Rewarding code "+code.id+" for payment")

                // Deze code werd nog niet beloond
                await code.reward()
            }
        }

        return new Response(undefined);
    }
}

