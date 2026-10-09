import { I18n } from '@stamhoofd/backend-i18n';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import type { MailchimpContactSource } from './buildContacts.js';
import { buildContacts } from './buildContacts.js';
import { MailchimpTags } from './MailchimpTags.js';

const tags = new MailchimpTags(new I18n(Language.Dutch, Country.Belgium));

function source(data: Partial<MailchimpContactSource> & { email: string; sortKey: string }): MailchimpContactSource {
    return {
        firstName: '',
        lastName: '',
        memberFirstName: null,
        groups: [],
        organizations: [],
        tags: [],
        consent: null,
        ...data,
    };
}

describe('buildContacts', () => {
    test('a parent of several members becomes one contact with the union of their data', () => {
        const contacts = buildContacts([
            source({ email: 'ouder@example.com', sortKey: '2', firstName: 'An', lastName: 'Peeters', memberFirstName: 'Lucas', groups: ['Welpen'], tags: [tags.parent, tags.group('Welpen')] }),
            source({ email: 'Ouder@Example.com ', sortKey: '1', firstName: 'Anna', lastName: 'Peeters', memberFirstName: 'Emma', groups: ['Kapoenen'], tags: [tags.parent, tags.group('Kapoenen')] }),
            source({ email: 'ouder@example.com', sortKey: '3', firstName: 'An', lastName: 'Peeters', memberFirstName: 'Noor', groups: ['Welpen'], tags: [tags.parent, tags.group('Welpen')] }),
        ]);

        expect(contacts).toHaveLength(1);
        expect(contacts[0]).toMatchObject({
            email: 'ouder@example.com',
            // Names come from the source with the lowest sort key
            firstName: 'Anna',
            lastName: 'Peeters',
            memberFirstNames: ['Emma', 'Lucas', 'Noor'],
            groups: ['Kapoenen', 'Welpen'],
        });
        expect(contacts[0].tags).toEqual([tags.group('Kapoenen'), tags.group('Welpen'), tags.parent].sort((a, b) => a.localeCompare(b)));
    });

    test('an address of both a member and a parent or customer gets all role tags', () => {
        const contacts = buildContacts([
            source({ email: 'jan@example.com', sortKey: 'b', tags: [tags.member] }),
            source({ email: 'jan@example.com', sortKey: 'a', tags: [tags.parent] }),
            source({ email: 'jan@example.com', sortKey: 'c', tags: [tags.customer, tags.webshop('Wafelbak')] }),
            source({ email: 'other@example.com', sortKey: 'd', tags: [tags.member] }),
        ]);

        expect(contacts).toHaveLength(2);
        const jan = contacts.find(c => c.email === 'jan@example.com')!;
        expect(jan.tags).toContain(tags.member);
        expect(jan.tags).toContain(tags.parent);
        expect(jan.tags).toContain(tags.customer);
        expect(jan.tags).toContain(tags.webshop('Wafelbak'));
    });

    test('consent is null without a newsletter record and true when at least one member opted in', () => {
        const contacts = buildContacts([
            source({ email: 'a@example.com', sortKey: '1', consent: null }),
            source({ email: 'b@example.com', sortKey: '2', consent: false }),
            source({ email: 'b@example.com', sortKey: '3', consent: true }),
            source({ email: 'c@example.com', sortKey: '4', consent: false }),
            source({ email: '  ', sortKey: '5' }),
        ]);

        expect(contacts.map(c => [c.email, c.consent])).toEqual([
            ['a@example.com', null],
            ['b@example.com', true],
            ['c@example.com', false],
        ]);
    });
});
