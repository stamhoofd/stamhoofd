import { I18n } from '@stamhoofd/backend-i18n/I18n';
import type { Email } from '@stamhoofd/models';
import { EmailRecipient, Organization, User } from '@stamhoofd/models';
import { fillRecipientReplacements, mergeReplacementsIfEqual, removeUnusedReplacements, runWithRecipientLocale, stripRecipientReplacementsForWebDisplay, stripSensitiveRecipientReplacements } from '@stamhoofd/models/helpers/EmailBuilder.js';
import type { BaseOrganization, EmailRecipient as EmailRecipientStruct, Replacement, User as UserStruct } from '@stamhoofd/structures';
import { EmailPreview, EmailRecipientFilter, EmailWithRecipients, getExampleRecipient } from '@stamhoofd/structures';
import { ExampleReplacements } from '@stamhoofd/structures/email/exampleReplacements.js';
import type { Language } from '@stamhoofd/types/Language';

/**
 * Builds the read-only structures of an email: the preview an administrator sees while composing or
 * browsing emails, and the version of a sent email a user sees in the member portal.
 */
export class EmailPreviewService {
    /**
     * @param options.allLanguages Also fill exampleRecipients: the same recipient with its
     * replacements generated in each supported language. Only use this for detail endpoints,
     * it repeats the replacement queries for every language.
     */
    static async getPreviewStructure(email: Email, options: { allLanguages?: boolean } = {}) {
        const emailRecipient = await EmailRecipient.select()
            .where('emailId', email.id)
            .where('email', '!=', null)
            .first(false);

        let baseRow: EmailRecipientStruct | undefined;

        if (emailRecipient) {
            baseRow = await emailRecipient.getStructure();
        }

        if (!baseRow) {
            baseRow = getExampleRecipient();
        }

        const organization = email.organizationId ? (await Organization.getByID(email.organizationId))! : null;
        const allowedLanguages = email.getLanguages();

        const fillRow = async (row: EmailRecipientStruct) => {
            const virtualRecipient = row.getRecipient();

            await fillRecipientReplacements(virtualRecipient, {
                organization,
                from: email.getFromAddress(),
                replyTo: null,
                forPreview: true,
                forceRefresh: !email.sentAt,
                allowedLanguages,
            });
            row.replacements = virtualRecipient.replacements;
            return row;
        };

        const recipientRow = await fillRow(baseRow.clone());

        // The same recipient in every supported language: the replacements are regenerated in
        // each language (the recipient's own language is ignored), so the composer can show
        // example values in the language that is being edited
        const exampleRecipients = new Map<Language, EmailRecipientStruct>();
        if (allowedLanguages && allowedLanguages.length > 1) {
            // The same country the recipient locale will resolve to (see getRecipientI18n)
            const country = organization?.address?.country ?? $getCountry();
            for (const language of allowedLanguages) {
                const i18n = new I18n(language, country);
                await I18n.runWithLocale(i18n, async () => {
                    const clone = baseRow.clone();
                    clone.language = language;

                    if (baseRow.language !== language) {
                        // Todo: this can be improved
                        // Replace all replacements with defaults
                        for (const replacement of clone.replacements) {
                            const example: Replacement | undefined = ExampleReplacements.all[replacement.token];
                            if (example) {
                                replacement.html = example.html;
                                replacement.value = example.value;
                            }
                        }

                        clone.replacements = clone.replacements.filter(r => !['organizationName'].includes(r.token));
                    }

                    const rr = await fillRow(clone);
                    exampleRecipients.set(language, rr);
                });
            }
        }

        let user: UserStruct | null = null;
        if (email.userId) {
            const u = await User.getByID(email.userId);
            if (u) {
                user = u.getStructure();
            }
        }

        let organizationStruct: BaseOrganization | null = null;
        if (organization) {
            organizationStruct = organization.getBaseStructure();
        }

        return EmailPreview.create({
            ...email,
            user,
            organization: organizationStruct,
            exampleRecipient: recipientRow,
            exampleRecipients,
        });
    }

    /**
     * Whether the email has content in this language (strict: the default content only counts
     * for its own language, see getEmailContentForLanguage)
     */
    private static hasContentForLanguage(email: Email, language: Language): boolean {
        return language === email.language || email.translations.has(language);
    }

    /**
     * @param options.language The language the caller is viewing in (from the request headers).
     * Recipients are returned in this language when the email has content for it, otherwise in
     * the language they received the email in.
     */
    static async getStructureForUser(email: Email, user: User, memberIds: string[], options: { language?: Language | null } = {}) {
        const emailRecipients = await EmailRecipient.select()
            .where('emailId', email.id)
            .where('memberId', memberIds)
            .fetch();
        const organization = email.organizationId ? (await Organization.getByID(email.organizationId))! : null;

        const recipientsMap: Map<string, EmailRecipient> = new Map();
        for (const memberId of memberIds) {
            const preferred = emailRecipients.find(e => e.memberId === memberId && (e.userId === user.id || e.email === user.email));
            if (preferred) {
                recipientsMap.set(preferred.duplicateOfRecipientId ?? preferred.id, preferred);
                continue;
            }

            const byMember = emailRecipients.find(e => e.memberId === memberId && e.userId === null && e.email === null);
            if (byMember) {
                recipientsMap.set(byMember.duplicateOfRecipientId ?? byMember.id, byMember);
                continue;
            }
            const anyData = emailRecipients.find(e => e.memberId === memberId);
            if (anyData) {
                recipientsMap.set(anyData.duplicateOfRecipientId ?? anyData.id, anyData);
                continue;
            }
        }

        // Remove duplicates that are marked as the same recipient
        const cleanedRecipients: EmailRecipient[] = [...recipientsMap.values()];
        const structures = await EmailRecipient.getStructures(cleanedRecipients);

        for (const struct of structures) {
            if (!(struct.userId === user.id || struct.email === user.email) && !((struct.userId === null && struct.email === null))) {
                stripSensitiveRecipientReplacements(struct, {
                    organization,
                    willFill: true,
                });
            }

            struct.firstName = user.firstName;
            struct.lastName = user.lastName;
            struct.email = user.email;
            struct.userId = user.id;

            // Show the email in the language the caller is viewing in, but only when the email
            // has content for it: otherwise keep the language the recipient received it in
            // (better correct content in the wrong language than wrong content in the right language)
            if (options.language && this.hasContentForLanguage(email, options.language)) {
                struct.language = options.language;
            }

            // We always refresh the data when we display it on the web (so everything is up to date)
            // The replacements are regenerated in struct.language, so they match the displayed content
            await fillRecipientReplacements(struct, {
                organization,
                from: email.getFromAddress(),
                replyTo: null,
                forPreview: false,
                forceRefresh: true,
                allowedLanguages: email.getLanguages(),
            });
            runWithRecipientLocale(struct, organization, () => {
                stripRecipientReplacementsForWebDisplay(struct, {
                    organization,
                });
            });
            if (email.html) {
                struct.replacements = removeUnusedReplacements(email.getCombinedHtml(), struct.replacements);
            }
        }

        // Loop structures and remove if they have exactly the same content
        // We do this here, because it is possible the user didn't receive any emails, so
        // the merging at time of sending the emails didn't happen (uniqueness happened on email)
        const uniqueStructures: EmailRecipientStruct[] = [];
        for (const struct of structures) {
            let found = false;
            for (const unique of uniqueStructures) {
                const merged = mergeReplacementsIfEqual(unique.replacements, struct.replacements);
                if (merged !== false) {
                    unique.replacements = merged;
                    found = true;
                    break;
                }
            }

            if (!found) {
                uniqueStructures.push(struct);
            }
        }

        let organizationStruct: BaseOrganization | null = null;
        if (organization) {
            organizationStruct = organization.getBaseStructure();
        }

        return EmailWithRecipients.create({
            ...email,
            organization: organizationStruct,
            recipients: uniqueStructures,

            // Remove private-like data
            softBouncesCount: 0,
            failedCount: 0,
            emailErrors: null,
            recipientsErrors: null,
            succeededCount: 1,
            emailRecipientsCount: 1,
            hardBouncesCount: 0,
            spamComplaintsCount: 0,
            recipientFilter: EmailRecipientFilter.create({}),
            membersCount: 1,
            otherRecipientsCount: 0,
        });
    }
}
