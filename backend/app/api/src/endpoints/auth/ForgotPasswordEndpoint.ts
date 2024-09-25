import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { PasswordToken, sendEmailTemplate, User } from '@stamhoofd/models';
import { EmailTemplateType, ForgotPasswordRequest, Recipient, Replacement } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context';

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
        const organization = await Context.setOptionalOrganizationScope()
        const user = await User.getForAuthentication(organization?.id ?? null, request.body.email, {allowWithoutAccount: true});
        
        if (!user) {
            // Create e-mail builder
            await sendEmailTemplate(organization, {
                recipients: [
                    Recipient.create({
                        email: request.body.email
                    })
                ],
                template: {
                    type: EmailTemplateType.ForgotPasswordButNoAccount,
                },
                type: 'transactional'
            })

            return new Response(undefined)
        }

        const recoveryUrl = await PasswordToken.getPasswordRecoveryUrl(user, organization, request.i18n)

        // Create e-mail builder
        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: request.body.email,
                    replacements: [
                        Replacement.create({
                            token: 'resetUrl',
                            value: recoveryUrl
                        })
                    ]
                })
            ],
            template: {
                type: EmailTemplateType.ForgotPassword,
            },
            type: 'transactional'
        })

        return new Response(undefined);
    }
}
