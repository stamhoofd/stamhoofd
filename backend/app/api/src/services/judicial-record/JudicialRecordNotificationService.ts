import type { JudicialRecord, MemberWithUsersAndRegistrations } from '@stamhoofd/models';
import { Member, MemberResponsibilityRecord, Organization, Platform, User } from '@stamhoofd/models';
import { EmailTemplateType, getAppHost, JudicialRecordHelper, JudicialRecordReviewDecision, Recipient, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { AdminPermissionChecker } from '../../helpers/AdminPermissionChecker.js';
import { sendEmailTemplate } from '../../helpers/EmailBuilder.js';
import { getJudicialRecordMinimumAges, getRequiringOrganizationIds } from './judicialRecordResponsibilities.js';

export class JudicialRecordNotificationService {
    /**
     * Tell the member what a reviewer decided about their extract.
     *
     * Called by the review flow rather than derived from the stored status, because an extract that passed
     * every automatic check is also stored as `Ok` without anyone having looked at it - and the member already
     * saw that result on screen when they delivered it.
     */
    static async sendDecision(record: JudicialRecord, member: Member): Promise<void> {
        const type = this.getDecisionTemplateType(record.reviewDecision);

        if (type === null) {
            return;
        }

        await this.send(type, record, member, [
            Replacement.create({
                token: 'feedbackText',
                html: record.reviewDetails?.comment
                    ? `<p class="pre-wrap"><em>${Formatter.escapeHtml(record.reviewDetails.comment)}</em></p>`
                    : '',
            }),
        ]);
    }

    /**
     * Warn the member that the decision on their extract is about to expire.
     *
     * Sent ahead of the expiry rather than after it: the member has to obtain a new document from the state,
     * so a notice that they are already blocked arrives too late to be acted on.
     */
    static async sendExpiryWarning(record: JudicialRecord, member: Member): Promise<void> {
        const expiryDate = JudicialRecordHelper.getExpiryDate(record.reviewedAt);

        if (expiryDate === null) {
            return;
        }

        await this.send(EmailTemplateType.JudicialRecordExpiringSoon, record, member, [
            Replacement.create({
                token: 'validUntilDate',
                value: Formatter.date(expiryDate, true),
            }),
        ]);
    }

    /**
     * Tell the people who may review that an extract is waiting for one.
     *
     * Sent only for a delivery that landed as `UnderReview`. An extract that passed every automatic check was
     * decided without anyone looking, so there is nothing waiting and nobody to call.
     */
    static async sendAwaitingReview(record: JudicialRecord, member: Member): Promise<void> {
        // Loaded again with its users and registrations, which is what deciding the review right needs.
        const loaded = await Member.getByIdWithUsersAndRegistrations(member.id);

        if (loaded === null) {
            return;
        }

        const recipients = await this.getReviewerRecipients(loaded);

        if (recipients.length === 0) {
            return;
        }

        const organization = await this.getSender(record, member);
        const senderName = organization?.name ?? (await Platform.getShared()).config.name;

        await sendEmailTemplate(organization, {
            recipients,
            template: {
                type: EmailTemplateType.JudicialRecordAwaitingReview,
                platformLevel: organization === null,
            },
            defaultReplacements: [
                Replacement.create({ token: 'firstNameMember', value: member.details.firstName }),
                Replacement.create({ token: 'lastNameMember', value: member.details.lastName }),
                Replacement.create({ token: 'platformOrOrganizationName', value: senderName }),
                Replacement.create({ token: 'reviewUrl', value: this.getReviewUrl(member, organization) }),
            ],
            type: 'transactional',
        });
    }

    /**
     * The administrators who may record a decision on this member's extract.
     *
     * The right is never granted by an organization to itself, so an organization's full admin does not have
     * it and the candidate list cannot be narrowed by permission level before asking. Each candidate is asked
     * about this member rather than in general, because the right is scoped per member.
     */
    private static async getReviewerRecipients(member: MemberWithUsersAndRegistrations): Promise<Recipient[]> {
        const responsibilities = await MemberResponsibilityRecord.where({ memberId: member.id });
        const organizationIds = getRequiringOrganizationIds(member, responsibilities, await getJudicialRecordMinimumAges(responsibilities));
        const platform = await Platform.getSharedPrivateStruct();

        const candidates = [
            ...await User.getPlatformAdmins(),
            ...(organizationIds.length > 0 ? await User.getAdmins(organizationIds) : []),
        ];

        // An administrator belonging to an organization has to be judged inside it: the checker refuses to
        // reason about one outside their own organization rather than quietly answering no.
        const organizations = new Map(
            (organizationIds.length > 0 ? await Organization.getByIDs(...organizationIds) : [])
                .map(organization => [organization.id, organization]),
        );

        const recipients: Recipient[] = [];
        const seen = new Set<string>();

        for (const user of candidates) {
            if (seen.has(user.id)) {
                continue;
            }
            seen.add(user.id);

            const organization = user.organizationId === null
                ? undefined
                : organizations.get(user.organizationId);

            // Belongs to an organization that does not ask this member for an extract, so there is nothing
            // for them to review and no organization to judge them in.
            if (user.organizationId !== null && organization === undefined) {
                continue;
            }

            const checker = new AdminPermissionChecker(user, platform, organization);

            if (!await checker.canReviewJudicialRecord(member)) {
                continue;
            }

            recipients.push(Recipient.create({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                language: user.language,
            }));
        }

        return recipients;
    }

    /**
     * The member in the dashboard, where the extract and the decision live.
     *
     * Built from the organization rather than from the request context: the trigger is a member delivering an
     * extract, so the context belongs to that member and not to the reviewer this link is for.
     */
    private static getReviewUrl(member: Member, organization: Organization | null): string {
        const host = getAppHost('dashboard', organization?.getBaseStructure() ?? null, true);

        return 'https://' + host + '/leden/' + encodeURIComponent(member.id);
    }

    /**
     * Tell the member that the decision no longer matches the name or birth date it was granted to.
     *
     * The mismatch is what changes their status back to `Required`, so this is sent off the status like the
     * expiry warning rather than off an event: nothing in the system knows who changed the name, and an
     * administrator correcting a spelling is the usual cause.
     */
    static async sendIdentityChanged(record: JudicialRecord, member: Member): Promise<void> {
        await this.send(EmailTemplateType.JudicialRecordIdentityChanged, record, member, []);
    }

    private static getDecisionTemplateType(reviewDecision: JudicialRecordReviewDecision): EmailTemplateType | null {
        switch (reviewDecision) {
            case JudicialRecordReviewDecision.UnderReview:
                // Nobody decided anything, so there is nothing to report.
                return null;

            case JudicialRecordReviewDecision.Ok:
                return EmailTemplateType.JudicialRecordApproved;

            case JudicialRecordReviewDecision.ConditionallyAccepted:
                return EmailTemplateType.JudicialRecordConditionallyAccepted;

            case JudicialRecordReviewDecision.TemporarilyRejected:
                return EmailTemplateType.JudicialRecordTemporarilyRejected;

            case JudicialRecordReviewDecision.PermanentlyRejected:
                return EmailTemplateType.JudicialRecordPermanentlyRejected;
        }
    }

    /**
     * The organization that sends, which also decides which wording the member gets.
     *
     * A reviewer decided on behalf of one organization, so that one sends. Null is the normal case rather than
     * an edge: on a platform a member has no organization of their own, and an extract that the automatic
     * checks approved carries no `reviewDetails` to name one either, so the most common send on a platform has
     * no organization at all. Callers must treat null as "send the platform wording" and say so explicitly,
     * never let it fall through to a template lookup that matches on type alone.
     */
    private static async getSender(record: JudicialRecord, member: Member): Promise<Organization | null> {
        const organizationId = record.reviewDetails?.organizationId ?? member.organizationId;

        if (organizationId === null) {
            return null;
        }

        return (await Organization.getByID(organizationId)) ?? null;
    }

    private static async send(type: EmailTemplateType, record: JudicialRecord, member: Member, replacements: Replacement[]): Promise<void> {
        // Only the member, never a parent: an extract is required from the age the responsibility sets, so the
        // recipient is an adult, and their judicial record is not their parents' business.
        const emails = Formatter.uniqueArray(member.details.getMemberEmails().map(email => email.toLowerCase().trim()));

        if (emails.length === 0) {
            return;
        }

        const organization = await this.getSender(record, member);
        const senderName = organization?.name ?? (await Platform.getShared()).config.name;
        const deliveryUrl = this.getDeliveryUrl(member, organization);

        await sendEmailTemplate(organization, {
            recipients: emails.map(email => Recipient.create({
                firstName: member.details.firstName,
                lastName: member.details.lastName,
                email,
                language: member.details.language,
                replacements: [
                    Replacement.create({ token: 'firstNameMember', value: member.details.firstName }),
                    Replacement.create({ token: 'lastNameMember', value: member.details.lastName }),
                    Replacement.create({ token: 'platformOrOrganizationName', value: senderName }),
                    Replacement.create({ token: 'judicialRecordUrl', value: deliveryUrl }),
                    ...replacements,
                ],
            })),
            template: {
                type,

                // Without an organization there is no organization wording to prefer, so the default is asked
                // for by name instead of being inferred from the absence of one.
                platformLevel: organization === null,
            },
            type: 'transactional',
        });
    }

    /**
     * The portal url that opens the delivery flow for this member, the same one the portal itself routes on.
     *
     * The Dutch path segment is hardcoded, as `/kampmeldingen/` is in the event notification emails. A
     * recipient reading another language would need the translated segment, which is not worth a lookup table
     * until a non-Dutch member actually has to deliver one.
     */
    private static getDeliveryUrl(member: Member, organization: Organization | null): string {
        const host = getAppHost('registration', organization?.getBaseStructure() ?? null, false);

        return 'https://' + host + '/strafregister/' + encodeURIComponent(member.id);
    }
}
