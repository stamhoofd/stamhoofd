import { Email } from './Email.js';

describe('Email', () => {
    it('should parse e-mail strings correctly', () => {
        expect(Email.parseEmailStr('"My crazy name" <hallo@stamhoofd.be>')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('hallo@stamhoofd.be')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('hallo@stamhoofd.be ')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('"hallo@stamhoofd.be"')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('<"hallo@stamhoofd.be">')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('Gekke naam <"hallo@stamhoofd.be">')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('<"hallo@stam\\"hoofd.be">')).toEqual([]);
        expect(Email.parseEmailStr('<"hallo@stam,hoofd.be">')).toEqual([]);
        expect(Email.parseEmailStr('<hallo@stam,hoofd.be>')).toEqual([]);
        expect(Email.parseEmailStr('"Hallo <dit is een test>" <hallo@stamhoofd.be>')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('"Hallo 👋🏽" <hallo@stamhoofd.be>')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('Hallo <hallo@stam.hoofd.be>')).toEqual(['hallo@stam.hoofd.be']);
        expect(Email.parseEmailStr('Hallo <hallo@stam.hoofd.be')).toEqual([]);

        expect(Email.parseEmailStr('"Hallo <dit is \\" een test>" <hallo@stamhoofd.be>')).toEqual(['hallo@stamhoofd.be']);
        expect(Email.parseEmailStr('"Hallo <dit is \\" een test佐>" <hallo@stamhoofd.be>')).toEqual(['hallo@stamhoofd.be']);

        expect(Email.parseEmailStr('"Voornaam \'l Achternaam, en nog iets" <jwz@netscape.com>')).toEqual(['jwz@netscape.com']);
        expect(Email.parseEmailStr('"Voornaam \'l Achternaam, en nog iets" <jwz@netscape.com>, "My crazy name" <hallo@stamhoofd.be>')).toEqual(['jwz@netscape.com', 'hallo@stamhoofd.be']);

        expect(Email.parseEmailStr('hallo@example.com, test@test.com')).toEqual(['hallo@example.com', 'test@test.com']);
        expect(Email.parseEmailStr('hallo@example.com, invalid, test@test.com')).toEqual(['hallo@example.com', 'test@test.com']);
    });
});
