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

    describe('fromString', () => {
        it('parses the title, name and phone', () => {
            const contact = EmergencyContact.fromString('Oma: An Peeters (0470 12 34 56)')!;
            expect(contact.title).toBe('Oma');
            expect(contact.name).toBe('An Peeters');
            expect(contact.phone).toBe('0470 12 34 56');
        });

        it('parses a contact without a phone', () => {
            const contact = EmergencyContact.fromString('Oma: An Peeters')!;
            expect(contact.title).toBe('Oma');
            expect(contact.name).toBe('An Peeters');
            expect(contact.phone).toBe(null);
        });

        it('parses a contact without a title', () => {
            const contact = EmergencyContact.fromString('An Peeters (0470 12 34 56)')!;
            expect(contact.title).toBe('');
            expect(contact.name).toBe('An Peeters');
            expect(contact.phone).toBe('0470 12 34 56');
        });

        it('parses a contact with only a phone', () => {
            const contact = EmergencyContact.fromString('0470 12 34 56')!;
            expect(contact.title).toBe('');
            expect(contact.name).toBe('');
            expect(contact.phone).toBe('0470 12 34 56');
        });

        it('parses a contact with only a name', () => {
            const contact = EmergencyContact.fromString('An Peeters')!;
            expect(contact.title).toBe('');
            expect(contact.name).toBe('An Peeters');
            expect(contact.phone).toBe(null);
        });

        it('treats a single token as the name, since the title cannot be recovered', () => {
            const contact = EmergencyContact.fromString('Oma')!;
            expect(contact.name).toBe('Oma');
            expect(contact.title).toBe('');
        });

        it('tolerates extra whitespace', () => {
            const contact = EmergencyContact.fromString('  Oma:   An Peeters   (0470 12 34 56)  ')!;
            expect(contact.title).toBe('Oma');
            expect(contact.name).toBe('An Peeters');
            expect(contact.phone).toBe('0470 12 34 56');
        });

        it('returns null for an empty or whitespace-only line', () => {
            expect(EmergencyContact.fromString('')).toBe(null);
            expect(EmergencyContact.fromString('   ')).toBe(null);
        });

        it('round-trips contacts that have a name', () => {
            const contacts = [
                EmergencyContact.create({ name: 'An Peeters', title: 'Oma', phone: '0470 12 34 56' }),
                EmergencyContact.create({ name: 'Jan Janssens', title: 'Buur', phone: null }),
                EmergencyContact.create({ name: 'Rita Maes', phone: '0470 11 22 33' }),
            ];

            for (const contact of contacts) {
                const parsed = EmergencyContact.fromString(contact.toString())!;
                expect(parsed.name).toBe(contact.name);
                expect(parsed.title).toBe(contact.title);
                expect(parsed.phone).toBe(contact.phone);
            }
        });
    });
});
