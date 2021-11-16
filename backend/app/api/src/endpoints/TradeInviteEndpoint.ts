import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Email, EmailInterface } from "@stamhoofd/email";
import { Invite } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
import { Organization, OrganizationSimple, PermissionLevel,Permissions, TradedInvite, User as UserStruct } from "@stamhoofd/structures";

type Params = { key: string };
type Query = undefined;
type Body = undefined
type ResponseBody = TradedInvite // encrypted keychain items or null

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class TradeInviteEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/invite/@key/trade", { key: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user
        const invites = await Invite.where({ key: decodeURIComponent(request.params.key), organizationId: user.organization.id }, { limit: 1 })

        if (invites.length != 1) {
            throw new SimpleError({
                code: "not_found",
                message: "This invite is invalid or expired",
                human: "Deze link is ongeldig of is vervallen",
                statusCode: 404
            })
        }

        const [invite] = invites

        if (invite.validUntil < new Date() || invite.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "expired",
                message: "This invite is expired",
                human: "Deze link is niet langer geldig, vraag om deze opnieuw te versturen",
                statusCode: 400
            })
        }

        if (invite.userDetails?.email && (user.email !== invite.userDetails.email || !user.verified)) {
            throw new SimpleError({
                code: "invalid_email",
                message: "This invite is only intended for an account with email "+invite.userDetails.email,
                human: "Je kan deze uitnodiging enkel accepteren op het account met e-mailadres "+invite.userDetails.email+". Vraag een nieuwe uitnodiging.",
                statusCode: 400
            })
        }

        if (invite.receiverId) {

            if (invite.receiverId != token.user.id) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Not authorized for this invitation",
                    human: "Deze link is niet gedeeld met jouw account, kijk na of je wel met het juiste account bent ingelogd",
                    statusCode: 403
                })
            }
        }

        const sender = await User.getByID(invite.senderId)
        if (!sender || (invite.permissions && !sender.permissions)) {
            throw new SimpleError({
                code: "not_found",
                message: "This invite is invalid or expired",
                human: "Deze link is niet langer geldig omdat hij is aangemaakt door een beheerder die geen toegang meer heeft",
                statusCode: 404
            })
        }
      
        let shouldSend = false
        if (invite.permissions) {
            if (!user.permissions) {
                user.permissions = Permissions.create({ level: PermissionLevel.None })
                shouldSend = true
            }

            // Check invites of old administrators
            if (!sender.permissions!.hasFullAccess()) {
                throw new SimpleError({
                    code: "not_found",
                    message: "This invite is invalid or expired",
                    human: "Deze link is niet langer geldig omdat hij aangemaakt is door een beheerder die zelf geen toegang meer heeft",
                    statusCode: 404
                })
            }

            user.permissions.roles = invite.permissions.roles
            user.permissions.level = invite.permissions.level

            await user.save();
        }
       
        // Delete invite
        await invite.delete()

        if (shouldSend) {
            // Send a welcome e-mail to the user
            const email: EmailInterface = {
                to: user.getEmailTo(),
                from: Email.getPersonalEmailFor(request.i18n),
                subject: "Welkom bij Stamhoofd: goed om te weten",
                type: "transactional",
                text: "Dag "+user.firstName+",\n\nSuper, je hebt net een nieuw beheerdersaccount aangemaakt bij "+user.organization.name+". Ik mag jou dus, samen met meer dan 3.000 andere vrijwilligers verwelkomen bij Stamhoofd! Met Stamhoofd willen we verenigingen, zoals "+user.organization.name+", ondersteunen in hun digitalisatie. Dat doen we door een aantal tools te bouwen en die aan heel betaalbare prijzen aan te bieden, specifiek voor verenigingen: bv. onze ledenadministratie, webshops en ticketverkoop.\n\nOm in te loggen in Stamhoofd, surf je naar https://"+request.i18n.$t("shared.domains.marketing")+", klik je op 'Inloggen' en zoek je naar '"+user.organization.name+"'. Daar kan je inloggen met jouw account.\n\nHeb je vragen, opmerkingen of ideeën? Dan kan je me altijd persoonlijk een e-mail sturen via "+request.i18n.$t("shared.emails.personal")+". Die beantwoord ik met alle plezier.\n\nPS: Download zeker de Stamhoofd-app in de App of Google Play Store\n\nMet vriendelijke groeten,\nSimon Backx\n— Oprichter van Stamhoofd"
            }

            Email.send(email)
        }
        return new Response(TradedInvite.create(Object.assign({}, invite, {
            receiver: token ? UserStruct.create(token.user) : null,
            sender: UserStruct.create(sender),
            organization: OrganizationSimple.create(user.organization)
        })));
    }
}
