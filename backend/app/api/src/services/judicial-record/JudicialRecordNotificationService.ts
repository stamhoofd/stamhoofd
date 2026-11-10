import type { JudicialRecord, Member } from '@stamhoofd/models';
import { Organization, Platform } from '@stamhoofd/models';
import { EmailTemplateType, getAppHost, JudicialRecordHelper, JudicialRecordReviewStatus, Recipient, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { sendEmailTemplate } from '../../helpers/EmailBuilder.js';

export class JudicialRecordNotificationService {
    /**
     * Tell the member what a reviewer decided about their extract.
     *
     * Called by the review flow rather than derived from the stored status, because an extract that passed
     * every automatic check is also stored as `Ok` without anyone having looked at it - and the member already
     * saw that result on screen when they delivered it.
     */
    static async sendDecision(record: JudicialRecord, member: Member): Promise<void> {
        const type = this.getDecisionTemplateType(record.reviewStatus);

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

    private static getDecisionTemplateType(reviewStatus: JudicialRecordReviewStatus): EmailTemplateType | null {
        switch (reviewStatus) {
            case JudicialRecordReviewStatus.UnderReview:
                // Nobody decided anything, so there is nothing to report.
                return null;

            case JudicialRecordReviewStatus.Ok:
                return EmailTemplateType.JudicialRecordApproved;

            case JudicialRecordReviewStatus.ConditionallyAccepted:
                return EmailTemplateType.JudicialRecordConditionallyAccepted;

            case JudicialRecordReviewStatus.TemporarilyRejected:
                return EmailTemplateType.JudicialRecordTemporarilyRejected;

            case JudicialRecordReviewStatus.PermanentlyRejected:
                return EmailTemplateType.JudicialRecordPermanentlyRejected;
        }
    }

    /**
     * The organization that sends, which also decides which wording the member gets.
     *
     * A reviewer decided on behalf of one organization, so that one sends. Falling back to the member's own
     * organization keeps the null branch out of reach in organization mode, where every member has one and
     * there is no platform to send instead.
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
