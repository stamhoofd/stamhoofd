import { EmergencyContact } from './EmergencyContact.js';

describe('EmergencyContact', () => {
    describe('toString', () => {
        it('combines the title, name and phone', () => {
            const contact = EmergencyContact.create({
                name: 'An Peeters',
                title: 'Oma',
                phone: '0470 12 34 56',
            });

            expect(contact.toString()).toBe('Oma: An Peeters (0470 12 34 56)');
        });

        it('leaves out the phone when it is not filled in', () => {
            const contact = EmergencyContact.create({
                name: 'An Peeters',
                title: 'Oma',
                phone: null,
            });

            expect(contact.toString()).toBe('Oma: An Peeters');
        });

        it('leaves out the title when it is not filled in', () => {
            const contact = EmergencyContact.create({
                name: 'An Peeters',
                phone: '0470 12 34 56',
            });

            expect(contact.toString()).toBe('An Peeters (0470 12 34 56)');
        });

        it('only returns the phone when the name and title are not filled in', () => {
            const contact = EmergencyContact.create({
                phone: '0470 12 34 56',
            });

            expect(contact.toString()).toBe('0470 12 34 56');
        });

        it('returns an empty string for an empty contact', () => {
            expect(EmergencyContact.create({}).toString()).toBe('');
        });
    });
});
