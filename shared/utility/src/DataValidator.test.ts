import { DataValidator } from './DataValidator.js';

describe('DataValidator', () => {
    describe('isEmailValid', () => {
        test('Accepts common email domains', () => {
            expect(DataValidator.isEmailValid('john@gmail.com')).toBe(true);
            expect(DataValidator.isEmailValid('john@telenet.be')).toBe(true);
            expect(DataValidator.isEmailValid('john@example.org')).toBe(true);
        });

        test('Rejects domains with a typo in a common domain', () => {
            expect(DataValidator.isEmailValid('john@gmai.com')).toBe(false);
            expect(DataValidator.isEmailValid('john@hotmal.com')).toBe(false);
            expect(DataValidator.isEmailValid('john@telnet.be')).toBe(false);
        });

        test('Accepts valid domains that look like a typo of a common domain', () => {
            expect(DataValidator.isEmailValid('john@ymail.com')).toBe(true);
            expect(DataValidator.isEmailValid('john@mail.com')).toBe(true);
            expect(DataValidator.isEmailValid('john@mailo.com')).toBe(true);
        });

        test('Rejects blocked domains', () => {
            expect(DataValidator.isEmailValid('john@gmail.be')).toBe(false);
        });
    });
});
