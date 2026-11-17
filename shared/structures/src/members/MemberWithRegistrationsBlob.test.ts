import { Language } from '@stamhoofd/types/Language';
import { User } from '../User.js';
import { MemberDetails } from './MemberDetails.js';
import { Parent } from './Parent.js';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';

describe('MemberWithRegistrationsBlob.getEmailRecipients', () => {
    const member = MemberWithRegistrationsBlob.create({
        details: MemberDetails.create({
            firstName: 'Jan',
            lastName: 'Peeters',
            email: 'jan@example.com',
            language: Language.Dutch,
            parents: [
                Parent.create({ firstName: 'Ann', lastName: 'Peeters', email: 'ann@example.com' }),
                Parent.create({ firstName: 'Bob', lastName: 'Peeters', email: 'bob@example.com' }),
            ],
            unverifiedEmails: ['unverified@example.com'],
        }),
        users: [User.create({ email: 'ann@example.com', language: Language.French })],
    });

    test('uses the language of the matching user, falling back to the member language', () => {
        const memberRecipients = member.getEmailRecipients(['member']);
        expect(memberRecipients.map((r) => [r.email, r.language])).toEqual([
            ['jan@example.com', Language.Dutch],
            [null, Language.Dutch],
        ]);

        const parentRecipients = member.getEmailRecipients(['parents']);
        expect(parentRecipients.map((r) => [r.email, r.language])).toEqual([
            ['ann@example.com', Language.French],
            ['bob@example.com', Language.Dutch],
        ]);

        expect(member.getEmailRecipients(['unverified']).map((r) => r.language)).toEqual([
            Language.Dutch,
        ]);
    });

    test('leaves the language empty when neither the member nor the user has one', () => {
        const withoutLanguage = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: 'Jan',
                lastName: 'Peeters',
                email: 'jan@example.com',
            }),
            users: [User.create({ email: 'jan@example.com' })],
        });
        expect(withoutLanguage.getEmailRecipients(['member']).map((r) => r.language)).toEqual([
            null,
            null,
        ]);
    });
});
