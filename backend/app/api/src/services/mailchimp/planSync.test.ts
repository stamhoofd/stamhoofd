import { I18n } from '@stamhoofd/backend-i18n';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { MailchimpSyncIssueReason } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import type { MailchimpContact } from './buildContacts.js';
import { MailchimpTags } from './MailchimpTags.js';
import type { MailchimpEmailStatus, MailchimpExistingContact, MailchimpPlanOptions } from './planSync.js';
import { planSync } from './planSync.js';

const tags = new MailchimpTags(new I18n(Language.Dutch, Country.Belgium));

function contact(data: Partial<MailchimpContact> & { email: string }): MailchimpContact {
    return {
        firstName: 'Jan',
        lastName: 'Peeters',
        memberFirstNames: [],
        groups: [],
        organizations: [],
        tags: [],
        consent: null,
        ...data,
    };
}

function existing(data: Partial<MailchimpExistingContact> & { email: string }): [string, MailchimpExistingContact] {
    return [data.email, { status: 'subscribed', tags: [], mergeFields: {}, ...data }];
}

const mergeFields = { firstName: 'FNAME', lastName: 'LNAME', members: 'SH_LEDEN', groups: 'SH_GROEPEN', organizations: null };

function options(data: Partial<MailchimpPlanOptions> = {}): MailchimpPlanOptions {
    return { kind: 'members', full: false, doubleOptIn: false, archiveRemoved: false, mergeFields, tags, ...data };
}

describe('planSync', () => {
    test('new contacts are added with merge fields, existing contacts keep their status', () => {
        const plan = planSync(
            [
                contact({ email: 'new@example.com', memberFirstNames: ['Emma', 'Lucas'], groups: ['Welpen'], tags: [tags.parent, tags.group('Welpen')] }),
                contact({ email: 'old@example.com', tags: [tags.member] }),
            ],
            new Map([existing({ email: 'old@example.com', status: 'unsubscribed', tags: [tags.member, 'VIP'] })]),
            new Map(),
            options({ doubleOptIn: true }),
        );

        expect(plan.skips).toEqual([]);
        expect(plan.upserts).toEqual([
            {
                email: 'new@example.com',
                isNew: true,
                statusIfNew: 'pending',
                unsubscribe: false,
                mergeFields: { FNAME: 'Jan', LNAME: 'Peeters', SH_LEDEN: 'Emma, Lucas', SH_GROEPEN: 'Welpen' },
                tags: [{ name: tags.parent, status: 'active' }, { name: tags.group('Welpen'), status: 'active' }],
            },
            expect.objectContaining({
                email: 'old@example.com',
                isNew: false,
                // Never resubscribes, only tag changes are sent
                unsubscribe: false,
                tags: [],
            }),
        ]);
    });

    test('blocked, invalid and unsubscribed addresses', () => {
        const status = new Map<string, MailchimpEmailStatus>([
            ['bounce@example.com', { unsubscribed: false, hardBounce: true, markedAsSpam: false }],
            ['spam@example.com', { unsubscribed: false, hardBounce: false, markedAsSpam: true }],
            ['unsub-new@example.com', { unsubscribed: true, hardBounce: false, markedAsSpam: false }],
            ['unsub-old@example.com', { unsubscribed: true, hardBounce: false, markedAsSpam: false }],
        ]);
        const plan = planSync(
            ['invalid@', 'bounce@example.com', 'spam@example.com', 'unsub-new@example.com', 'unsub-old@example.com'].map(email => contact({ email })),
            new Map([existing({ email: 'unsub-old@example.com' })]),
            status,
            options(),
        );

        expect(plan.skips).toEqual([
            { email: 'invalid@', reason: MailchimpSyncIssueReason.InvalidEmail },
            { email: 'bounce@example.com', reason: MailchimpSyncIssueReason.HardBounce },
            { email: 'spam@example.com', reason: MailchimpSyncIssueReason.MarkedAsSpam },
            { email: 'unsub-new@example.com', reason: MailchimpSyncIssueReason.Unsubscribed },
        ]);
        expect(plan.upserts).toEqual([expect.objectContaining({ email: 'unsub-old@example.com', unsubscribe: true })]);
    });

    test('contacts archived in Mailchimp are skipped and never touched', () => {
        const status = new Map<string, MailchimpEmailStatus>([['bounce@example.com', { unsubscribed: false, hardBounce: true, markedAsSpam: false }]]);
        const plan = planSync(
            [contact({ email: 'bounce@example.com' }), contact({ email: 'no-consent@example.com', consent: false }), contact({ email: 'back@example.com', tags: [tags.member] })],
            new Map([
                existing({ email: 'bounce@example.com', status: 'archived' }),
                existing({ email: 'no-consent@example.com', status: 'archived' }),
                existing({ email: 'back@example.com', status: 'archived', tags: [tags.member] }),
            ]),
            status,
            options({ full: true }),
        );

        expect(plan.skips).toEqual([
            { email: 'bounce@example.com', reason: MailchimpSyncIssueReason.HardBounce },
            { email: 'no-consent@example.com', reason: MailchimpSyncIssueReason.ArchivedInMailchimp },
            { email: 'back@example.com', reason: MailchimpSyncIssueReason.ArchivedInMailchimp },
        ]);
        expect(plan.upserts).toEqual([]);
        expect(plan.removals).toEqual([]);
    });

    test('contacts without newsletter consent are only unsubscribed in a full sync', () => {
        const contacts = [contact({ email: 'new@example.com', consent: false }), contact({ email: 'old@example.com', consent: false }), contact({ email: 'yes@example.com', consent: true })];
        const audience = new Map([existing({ email: 'old@example.com' })]);

        const selection = planSync(contacts, audience, new Map(), options());
        expect(selection.skips.map(s => [s.email, s.reason])).toEqual([
            ['new@example.com', MailchimpSyncIssueReason.NoConsent],
            ['old@example.com', MailchimpSyncIssueReason.NoConsent],
        ]);
        expect(selection.upserts.map(u => u.email)).toEqual(['yes@example.com']);

        const full = planSync(contacts, audience, new Map(), options({ full: true }));
        expect(full.skips.map(s => s.email)).toEqual(['new@example.com']);
        expect(full.upserts.map(u => [u.email, u.unsubscribe])).toEqual([['old@example.com', true], ['yes@example.com', false]]);
    });

    test('a full sync replaces stale member tags and merge fields, a selection only adds', () => {
        const contacts = [contact({ email: 'ouder@example.com', memberFirstNames: ['Emma'], groups: ['Jongverkenners'], tags: [tags.parent, tags.group('Jongverkenners')] })];
        const audience = new Map([existing({
            email: 'ouder@example.com',
            tags: [tags.parent, tags.group('Welpen'), tags.customer, tags.webshop('Wafelbak'), tags.removed, 'Eigen tag'],
            mergeFields: { SH_LEDEN: 'Lucas', SH_GROEPEN: 'Welpen' },
        })]);

        const full = planSync(contacts, audience, new Map(), options({ full: true }));
        expect(full.upserts[0].tags).toEqual([
            { name: tags.group('Jongverkenners'), status: 'active' },
            { name: tags.group('Welpen'), status: 'inactive' },
            { name: tags.removed, status: 'inactive' },
        ]);
        expect(full.upserts[0].mergeFields).toMatchObject({ SH_LEDEN: 'Emma', SH_GROEPEN: 'Jongverkenners' });

        const truncated = planSync(contacts, new Map([existing({ email: 'ouder@example.com', mergeFields: { SH_LEDEN: 'Lucas, Noo…' } })]), new Map(), options());
        expect(truncated.upserts[0].mergeFields.SH_LEDEN).toBe('Lucas, Emma');

        const selection = planSync(contacts, audience, new Map(), options());
        expect(selection.upserts[0].tags).toEqual([{ name: tags.group('Jongverkenners'), status: 'active' }]);
        expect(selection.upserts[0].mergeFields).toMatchObject({ SH_LEDEN: 'Lucas, Emma', SH_GROEPEN: 'Welpen, Jongverkenners' });
    });

    test('a full sync marks and optionally archives contacts that no longer match', () => {
        const audience = new Map([
            existing({ email: 'gone@example.com', tags: [tags.member, tags.group('Welpen'), 'Eigen tag'] }),
            existing({ email: 'marked@example.com', tags: [tags.removed] }),
            existing({ email: 'customer@example.com', tags: [tags.customer] }),
            existing({ email: 'external@example.com', tags: ['Eigen tag'] }),
            existing({ email: 'former-member-customer@example.com', tags: [tags.parent, tags.webshop('Wafelbak')] }),
            existing({ email: 'archived@example.com', status: 'archived', tags: [tags.member] }),
        ]);

        const plan = planSync([], audience, new Map(), options({ full: true }));
        expect(plan.removals.map(r => r.email)).toEqual(['gone@example.com', 'former-member-customer@example.com']);
        expect(plan.removals[0]).toEqual({
            email: 'gone@example.com',
            tags: [
                { name: tags.member, status: 'inactive' },
                { name: tags.group('Welpen'), status: 'inactive' },
                { name: tags.removed, status: 'active' },
            ],
            archive: false,
            markAsRemoved: true,
        });

        const archive = planSync([], audience, new Map(), options({ full: true, archiveRemoved: true }));
        // Customers keep their place in the audience
        expect(archive.removals.map(r => [r.email, r.archive, r.markAsRemoved])).toEqual([
            ['gone@example.com', true, true],
            ['marked@example.com', true, false],
            ['former-member-customer@example.com', false, true],
        ]);

        expect(planSync([], audience, new Map(), options()).removals).toEqual([]);
        expect(planSync([], audience, new Map(), options({ kind: 'orders', full: true })).removals).toEqual([]);
    });

    test('order syncs only fill in missing names and never touch member fields', () => {
        const plan = planSync(
            [contact({ email: 'a@example.com', firstName: 'Bestel', lastName: 'Naam', tags: [tags.customer] }), contact({ email: 'b@example.com', firstName: 'Bestel', lastName: 'Naam', tags: [tags.customer] })],
            new Map([existing({ email: 'a@example.com', mergeFields: { FNAME: 'Anna', LNAME: '' } })]),
            new Map(),
            options({ kind: 'orders' }),
        );

        expect(plan.upserts.map(u => u.mergeFields)).toEqual([
            { LNAME: 'Naam' },
            { FNAME: 'Bestel', LNAME: 'Naam' },
        ]);
    });
});
