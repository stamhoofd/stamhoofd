import { MailchimpSyncIssueReason } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { DataValidator } from '@stamhoofd/utility';
import type { MailchimpContact } from './buildContacts.js';
import type { MailchimpTags } from './MailchimpTags.js';

/**
 * Maximum length of a Mailchimp text merge field
 */
const MAX_MERGE_FIELD_LENGTH = 255;

export type MailchimpExistingContact = {
    email: string;
    status: string;
    tags: string[];
    mergeFields: Record<string, unknown>;
};

export type MailchimpEmailStatus = {
    unsubscribed: boolean;
    hardBounce: boolean;
    markedAsSpam: boolean;
};

/**
 * Merge tags that exist in the audience, null when the field is not available
 */
export type MailchimpMergeFieldTags = {
    firstName: string | null;
    lastName: string | null;
    members: string | null;
    groups: string | null;
    organizations: string | null;
};

export type MailchimpPlanOptions = {
    kind: 'members' | 'orders';

    /**
     * A full sync knows every registered member, so it can remove stale tags,
     * unsubscribe contacts without consent and mark contacts that no longer match.
     */
    full: boolean;
    doubleOptIn: boolean;
    archiveRemoved: boolean;
    mergeFields: MailchimpMergeFieldTags;
    tags: MailchimpTags;
};

export type MailchimpTagChange = {
    name: string;
    status: 'active' | 'inactive';
};

export type MailchimpUpsert = {
    email: string;
    isNew: boolean;
    statusIfNew: 'subscribed' | 'pending';

    /**
     * Change the status of the existing contact to unsubscribed
     */
    unsubscribe: boolean;
    mergeFields: Record<string, string>;
    tags: MailchimpTagChange[];
};

export type MailchimpRemoval = {
    email: string;
    tags: MailchimpTagChange[];
    archive: boolean;

    /**
     * False when the contact was already marked in an earlier sync and only gets archived now
     */
    markAsRemoved: boolean;
};

export type MailchimpSkip = {
    email: string;
    reason: MailchimpSyncIssueReason;
};

export type MailchimpPlan = {
    upserts: MailchimpUpsert[];
    removals: MailchimpRemoval[];
    skips: MailchimpSkip[];
};

const unsubscribableStatuses = new Set(['subscribed', 'pending']);

function truncate(value: string) {
    if (value.length <= MAX_MERGE_FIELD_LENGTH) {
        return value;
    }
    return value.substring(0, MAX_MERGE_FIELD_LENGTH - 1) + '…';
}

function joinList(values: string[], existing: unknown, keepExisting: boolean) {
    const result: string[] = [];
    if (keepExisting && typeof existing === 'string') {
        // A truncated value ends with a partial name
        result.push(...existing.split(', ').filter(v => v.length > 0 && !v.endsWith('…')));
    }
    for (const value of values) {
        if (!result.includes(value)) {
            result.push(value);
        }
    }
    return truncate(result.join(', '));
}

function getSkipReason(contact: MailchimpContact, status: MailchimpEmailStatus | undefined): MailchimpSyncIssueReason | null {
    if (!DataValidator.isEmailValid(contact.email)) {
        return MailchimpSyncIssueReason.InvalidEmail;
    }
    if (status?.hardBounce) {
        return MailchimpSyncIssueReason.HardBounce;
    }
    if (status?.markedAsSpam) {
        return MailchimpSyncIssueReason.MarkedAsSpam;
    }
    return null;
}

function buildMergeFields(contact: MailchimpContact, existing: MailchimpExistingContact | undefined, options: MailchimpPlanOptions) {
    const fields: Record<string, string> = {};
    const tags = options.mergeFields;

    // Order synchronisations never overwrite names that are already filled in
    const setName = (tag: string | null, value: string) => {
        if (!tag || !value) {
            return;
        }
        if (options.kind === 'orders' && existing && existing.mergeFields[tag]) {
            return;
        }
        fields[tag] = truncate(value);
    };
    setName(tags.firstName, contact.firstName);
    setName(tags.lastName, contact.lastName);

    if (options.kind === 'members') {
        // A selection only contains part of the linked members, so keep the existing values
        const keepExisting = !options.full;
        if (tags.members) {
            fields[tags.members] = joinList(contact.memberFirstNames, existing?.mergeFields[tags.members], keepExisting);
        }
        if (tags.groups) {
            fields[tags.groups] = joinList(contact.groups, existing?.mergeFields[tags.groups], keepExisting);
        }
        if (tags.organizations) {
            fields[tags.organizations] = joinList(contact.organizations, existing?.mergeFields[tags.organizations], keepExisting);
        }
    }
    return fields;
}

function buildTagChanges(contact: MailchimpContact, existing: MailchimpExistingContact | undefined, options: MailchimpPlanOptions): MailchimpTagChange[] {
    const current = new Set(existing?.tags ?? []);
    const changes: MailchimpTagChange[] = [];

    for (const tag of contact.tags) {
        if (!current.has(tag)) {
            changes.push({ name: tag, status: 'active' });
        }
    }

    if (options.kind === 'members' && options.full) {
        const desired = new Set(contact.tags);
        for (const tag of current) {
            if (options.tags.isMemberTag(tag) && !desired.has(tag)) {
                changes.push({ name: tag, status: 'inactive' });
            }
        }
    }
    return changes;
}

export function planSync(
    contacts: MailchimpContact[],
    existingContacts: Map<string, MailchimpExistingContact>,
    emailStatus: Map<string, MailchimpEmailStatus>,
    options: MailchimpPlanOptions,
): MailchimpPlan {
    const plan: MailchimpPlan = { upserts: [], removals: [], skips: [] };
    const statusIfNew = options.doubleOptIn ? 'pending' : 'subscribed';

    for (const contact of contacts) {
        const existing = existingContacts.get(contact.email);
        const status = emailStatus.get(contact.email);

        const skipReason = getSkipReason(contact, status);
        if (skipReason) {
            plan.skips.push({ email: contact.email, reason: skipReason });
            continue;
        }

        // Mailchimp accepts the update but keeps the contact archived, so it would silently stay out of the audience
        if (existing?.status === 'archived') {
            plan.skips.push({ email: contact.email, reason: MailchimpSyncIssueReason.ArchivedInMailchimp });
            continue;
        }

        let unsubscribe = false;
        if (status?.unsubscribed) {
            if (!existing) {
                plan.skips.push({ email: contact.email, reason: MailchimpSyncIssueReason.Unsubscribed });
                continue;
            }
            unsubscribe = true;
        }

        if (contact.consent === false) {
            // Only a full sync knows all linked members, so only then can missing consent unsubscribe someone
            if (!existing || !options.full) {
                plan.skips.push({ email: contact.email, reason: MailchimpSyncIssueReason.NoConsent });
                continue;
            }
            unsubscribe = true;
        }

        plan.upserts.push({
            email: contact.email,
            isNew: !existing,
            statusIfNew,
            unsubscribe: unsubscribe && !!existing && unsubscribableStatuses.has(existing.status),
            mergeFields: buildMergeFields(contact, existing, options),
            tags: buildTagChanges(contact, existing, options),
        });
    }

    if (options.kind === 'members' && options.full) {
        const included = new Set(contacts.map(c => c.email));

        for (const existing of existingContacts.values()) {
            if (included.has(existing.email) || existing.status === 'archived') {
                continue;
            }

            const tags = options.tags;
            const staleTags = existing.tags.filter(tag => tags.isMemberTag(tag) && tag !== tags.removed);
            const isMarked = existing.tags.includes(tags.removed);

            // Customers stay in the audience for their orders
            const archive = options.archiveRemoved && !existing.tags.some(tag => tags.isOrderTag(tag));

            if (staleTags.length > 0) {
                plan.removals.push({
                    email: existing.email,
                    tags: [
                        ...staleTags.map(name => ({ name, status: 'inactive' as const })),
                        ...(isMarked ? [] : [{ name: tags.removed, status: 'active' as const }]),
                    ],
                    archive,
                    markAsRemoved: true,
                });
            }
            else if (isMarked && archive) {
                plan.removals.push({
                    email: existing.email,
                    tags: [],
                    archive: true,
                    markAsRemoved: false,
                });
            }
        }
    }

    return plan;
}
