import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, PasswordToken, Platform, sendEmailTemplate, User } from '@stamhoofd/models';
import { EmailTemplateType, LoginMethod, NewUser, Recipient, Replacement, SignupResponse } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = NewUser;
type ResponseBody = SignupResponse;

export class SignupEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = NewUser as Decoder<NewUser>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/sign-up', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope({ willAuthenticate: false });

        if (STAMHOOFD.userMode === 'platform') {
            const platform = await Platform.getShared();
            if (!platform.config.loginMethods.has(LoginMethod.Password)) {
                throw new SimpleError({
                    code: 'not_supported',
                    message: 'This platform does not support password login',
                    human: $t(`4af15b54-0bbb-4112-adf2-26dd14e8675a`),
                    statusCode: 400,
                });
            }
        }

        const u = await User.getForRegister(organization?.id ?? null, request.body.email);

        // Don't optimize. Always run two queries atm.
        let user = u
            ? undefined
            : (await User.register(
                    organization,
                    request.body,
                ));

        let sendCode = true;

        if (!user) {
            if (!u) {
                // Fail silently because user did exist, and we don't want to expose that the user doesn't exists
                console.error("Could not register, but user doesn't exist: " + request.body.email);

                throw new SimpleError({
                    code: 'unexpected_error',
                    message: 'Something went wrong',
                    human: $t(`44e0c667-07c5-4ff9-8bf2-623d9aa91219`),
                    statusCode: 500,
                });
            }

            user = u;

            if (u.hasAccount()) {
                // Don't send the code
                sendCode = false;

                // We don't await this block to avoid user enumeration attack using request response time
                (async () => {
                    // Send an e-mail to say you already have an account + follow password forgot flow
                    const recoveryUrl = await PasswordToken.getPasswordRecoveryUrl(user, organization, request.i18n);

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
                                        value: recoveryUrl,
                                    }),
                                ],
                            }),
                        ],
                        template: {
                            type: EmailTemplateType.SignupAlreadyHasAccount,
                        },
                        type: 'transactional',
                    });
                })().catch(console.error);
            }
            else {
                // This is safe, because we are the first one. There is no password yet.
                // If a hacker tries this, he won't be able to sign in, because he needs to
                // verify the e-mail first (same as if the user didn't exist)
                // If we didn't set the password, we would allow a different kind of attack:
                // a hacker could send an e-mail to the user (try to register again, seindgin a new email which would trigger a different password change), right after the user registered (without verifying yet), when he had set a different password
                // user clicks on second e-mail -> this sets the hackers password instead
                user.verified = false;
                await user.changePassword(request.body.password);
                await PasswordToken.clearFor(user.id);
                await user.save();
            }
        }

        // We always need the code, to return it. Also on password recovery -> may not be visible to the client whether the user exists or not
        const code = await EmailVerificationCode.createFor(user, user.email);

        if (sendCode) {
            code.send(user, organization, request.i18n).catch(console.error);
        }

        return new Response(SignupResponse.create({
            token: code.token,
        }));
    }
}
