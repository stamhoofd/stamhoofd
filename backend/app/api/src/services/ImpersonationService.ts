import { SimpleError } from '@simonbackx/simple-errors';
import type { Token } from '@stamhoofd/models';
import { AuditLog, ImpersonationToken, Organization, User } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType, ImpersonationTicket } from '@stamhoofd/structures';

import { Context } from '../helpers/Context.js';
import { SessionService } from './SessionService.js';

/**
 * Signing in as another user, to see the application the way that user sees it.
 *
 * The session that comes out of this stays the administrator's: it keeps their user id and
 * only carries the impersonated account alongside it, so every change is attributed to the
 * administrator and every access check is made for both accounts (see UserSession and
 * ImpersonatedPermissionChecker). This service guards the two moments where impersonation
 * is handed out: asking for a link and trading that link for a session.
 */
export class ImpersonationService {
    /**
     * Create the one-time ticket behind an impersonation link.
     *
     * The ticket is not a session yet: it is meant to be opened in a private window, which
     * is the only way to look at the application as somebody else without throwing away
     * the administrator's own session.
     */
    static async createTicket(impersonatedUser: User): Promise<ImpersonationTicket> {
        const user = Context.user;

        if (!user) {
            throw new SimpleError({
                code: 'not_authenticated',
                message: 'Not authenticated',
                statusCode: 401,
            });
        }

        // An impersonated session may not start another one: that would build a chain in
        // which the account that is responsible becomes impossible to tell.
        Context.assertNotImpersonating();

        await this.assertEnabled();

        if (!await Context.auth.canImpersonate(impersonatedUser)) {
            throw Context.auth.error({
                message: 'Not allowed to impersonate this user',
                human: $t(`Je hebt geen toegang om aan te melden als deze gebruiker. Deze gebruiker heeft op één of andere manier meer toegangsrechten dan jou, of toegang tot data waar jij niet aankan (bv. inschrijvingen bij andere vereniging), vandaar dat het niet kan.`),
            });
        }

        const model = await ImpersonationToken.createFor({
            userId: user.id,
            impersonatedUserId: impersonatedUser.id,
            organizationId: Context.organization?.id ?? null,
            ip: Context.request.getIP(),
        });

        return ImpersonationTicket.create({
            ticket: model.token,
            validUntil: model.expiresAt,
        });
    }

    /**
     * Trade a ticket for a session that impersonates the account it was created for.
     *
     * The permission to impersonate is checked again here: the ticket only proves that the
     * administrator asked for it, not that they are still allowed to use it.
     */
    static async redeemTicket(ticket: string): Promise<Token> {
        const invalid = new SimpleError({
            code: 'invalid_impersonation_ticket',
            message: 'The impersonation link is invalid or expired',
            human: $t(`Deze link is niet meer geldig. Vraag een nieuwe link aan.`),
            statusCode: 400,
        });

        const model = await ImpersonationToken.getValid(ticket);

        if (!model) {
            throw invalid;
        }

        // The link only works from the address it was requested from, so forwarding it to
        // somebody else - to sign them into an account that is not theirs - gets nowhere.
        // A client cannot fake this address: Caddy overwrites X-Forwarded-For in production
        if (model.createdIp !== Context.request.getIP()) {
            console.error('Impersonation ticket used from a different IP address', model.createdIp, Context.request.getIP());
            throw invalid;
        }

        const [user, impersonatedUser] = await Promise.all([
            User.getByID(model.userId),
            User.getByID(model.impersonatedUserId),
        ]);

        if (!user || !impersonatedUser) {
            await model.consume();
            throw invalid;
        }

        // Restore the scope the link was created in: permissions are organization bound, so
        // the check below has to look at the same organization as the one that decided the
        // administrator could create this link. The link itself is the proof of scope - it
        // is single use and only works from the address that asked for it.
        if (model.organizationId && Context.organization?.id !== model.organizationId) {
            const organization = await Organization.getByID(model.organizationId);
            if (!organization) {
                await model.consume();
                throw invalid;
            }
            await Context.setManualOrganizationScope(organization);
        }

        await Context.insecurelyAuthenticateAs(user);

        if (!await Context.isImpersonationEnabled()) {
            await model.consume();
            throw invalid;
        }

        if (!await Context.auth.canImpersonate(impersonatedUser)) {
            await model.consume();
            throw Context.auth.error({
                message: 'Not allowed to impersonate this user',
                human: $t(`Je hebt geen toegang om aan te melden als deze gebruiker.`),
            });
        }

        // A ticket hands out exactly one session, even when two requests redeem it at the
        // same time.
        if (!await model.consume()) {
            throw invalid;
        }

        if (STAMHOOFD.environment === 'development') {
            // Special case for debugging: we create true tokens
            const token = await SessionService.createSession(impersonatedUser);

            if (!impersonatedUser.verified) {
                impersonatedUser.verified = true;
            }
            if (!impersonatedUser.hasAccount()) {
                await impersonatedUser.changePassword('stamhoofd');
            }
            await impersonatedUser.save();
            await this.logImpersonation(user, impersonatedUser, model.organizationId);
            return token;
        }

        const token = await SessionService.createImpersonationSession(user, impersonatedUser);
        await this.logImpersonation(user, impersonatedUser, model.organizationId);

        return token;
    }

    /**
     * Impersonation is opt-in: for the whole platform, or for one organization (which only
     * a platform admin can switch on). Checked where a session is handed out, not on every
     * request: a session that is already running only depends on the permissions.
     */
    private static async assertEnabled() {
        if (!await Context.isImpersonationEnabled()) {
            throw new SimpleError({
                code: 'feature_disabled',
                message: 'Impersonation is not enabled for this organization',
                human: $t(`Inloggen als een andere gebruiker is niet ingeschakeld voor deze vereniging.`),
                statusCode: 403,
            });
        }
    }

    /**
     * Record who looked through whose account. This is the only trace impersonation leaves
     * in the data itself: everything the session changes afterwards is already logged under
     * the administrator's own name.
     */
    private static async logImpersonation(user: User, impersonatedUser: User, organizationId: string | null) {
        const log = new AuditLog();
        log.type = AuditLogType.UserImpersonated;
        log.source = AuditLogSource.User;
        log.userId = user.id;
        log.objectId = impersonatedUser.id;
        log.organizationId = organizationId ?? impersonatedUser.organizationId;

        log.replacements = new Map([
            ['u', AuditLogReplacement.create({
                id: impersonatedUser.id,
                value: impersonatedUser.email,
                type: AuditLogReplacementType.User,
            })],
            ['u2', AuditLogReplacement.create({
                id: user.id,
                value: user.email,
                type: AuditLogReplacementType.User,
            })],
        ]);

        await log.save();
    }
}
