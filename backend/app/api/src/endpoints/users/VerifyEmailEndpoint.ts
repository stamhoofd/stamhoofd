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
                if (other.hasAccount()) {
                    throw new SimpleError({
                        code: "email_in_use",
                        message: "This e-mail is already in use, we cannot set it",
                        human: "We kunnen het e-mailadres van deze gebruiker niet instellen naar "+code.email+", omdat die al in gebruik is. Waarschijnlijk heb je meerdere accounts. Probeer met dat e-mailadres in te loggen of contacteer ons ("+request.$t("shared.emails.general")+") als we de gebruikers moeten combineren tot één gebruiker."
                    })
                }

                // Delete placeholder account, but migrate members first
                const members = await Member.getMembersWithRegistrationForUser(other)

                if (members.length > 0) {
                    console.log("Moving members from user "+other.id+" to "+user.id)
                    await Member.users.reverse("members").link(user, members)
                }

                await other.delete()
            }

            
            // change user email
            user.email = code.email

            // If already in use: will fail, so will verification
        }

        let shouldSend = false

        if (!user.verified && user.permissions !== null) {
            shouldSend = true
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

        if (shouldSend) {
            const admins = await organization.getAdmins()

            if (admins.length == 1) {
                // Send a welcome e-mail to the user
                const email: EmailInterface = {
                    to: user.getEmailTo(),
                    from: Email.getPersonalEmailFor(request.i18n),
                    subject: "Welkom bij Stamhoofd: goed om te weten",
                    type: "transactional",
                    text: "Dag "+user.firstName+",\n\nSuper, je hebt "+organization.name+" aansloten bij Stamhoofd. Ik mag jou dus, samen met meer dan 10.000 andere vrijwilligers verwelkomen bij Stamhoofd! Met Stamhoofd willen we verenigingen ondersteunen in hun digitalisatie. Dat doen we door een aantal tools te bouwen en die aan heel betaalbare prijzen aan te bieden, specifiek voor verenigingen.\n\nHeb je vragen, opmerkingen of ideeën? Neem dan zeker een kijkje op op https://"+request.i18n.$t("shared.domains.marketing")+"/docs en https://feedback.stamhoofd.app. Daarnaast nog iets onduidelijk? Dan kan je me altijd persoonlijk een e-mail sturen via "+request.i18n.$t("shared.emails.personal")+". Die beantwoord ik met alle plezier.\n\nPS: Download zeker de Stamhoofd-app in de App of Google Play Store\n\nVeel succes en bedankt voor het vertrouwen,\nSimon Backx\n— Oprichter van Stamhoofd"
                }

                Email.send(email)
            }
        }
        return new Response(st);
    }
}