/**
 * One email address of one person in Stamhoofd: a member, a parent of a member or the customer of an order.
 */
export type MailchimpContactSource = {
    email: string;
    firstName: string;
    lastName: string;

    /**
     * Stable ordering key (member or order id) so the same input always produces the same names
     */
    sortKey: string;

    /**
     * First name of the linked member
     */
    memberFirstName: string | null;
    groups: string[];
    organizations: string[];
    tags: string[];

    /**
     * Null when no newsletter record is configured
     */
    consent: boolean | null;
};

export type MailchimpContact = {
    /**
     * Lowercase, also the key of the contact in Mailchimp
     */
    email: string;
    firstName: string;
    lastName: string;
    memberFirstNames: string[];
    groups: string[];
    organizations: string[];
    tags: string[];

    /**
     * Null when no newsletter record is configured, true when at least one linked member opted in
     */
    consent: boolean | null;
};

function addUnique(list: string[], values: (string | null)[]) {
    for (const value of values) {
        if (value && !list.includes(value)) {
            list.push(value);
        }
    }
}

/**
 * Merges sources into one contact per email address
 */
export function buildContacts(sources: MailchimpContactSource[]): MailchimpContact[] {
    const sorted = [...sources].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const contacts = new Map<string, MailchimpContact>();

    for (const source of sorted) {
        const email = source.email.trim().toLowerCase();
        if (!email) {
            continue;
        }

        let contact = contacts.get(email);
        if (!contact) {
            contact = {
                email,
                firstName: source.firstName,
                lastName: source.lastName,
                memberFirstNames: [],
                groups: [],
                organizations: [],
                tags: [],
                consent: null,
            };
            contacts.set(email, contact);
        }

        addUnique(contact.memberFirstNames, [source.memberFirstName]);
        addUnique(contact.groups, source.groups);
        addUnique(contact.organizations, source.organizations);
        addUnique(contact.tags, source.tags);

        if (source.consent !== null) {
            contact.consent = (contact.consent ?? false) || source.consent;
        }
    }

    for (const contact of contacts.values()) {
        contact.memberFirstNames.sort((a, b) => a.localeCompare(b));
        contact.groups.sort((a, b) => a.localeCompare(b));
        contact.organizations.sort((a, b) => a.localeCompare(b));
        contact.tags.sort((a, b) => a.localeCompare(b));
    }

    return [...contacts.values()];
}
