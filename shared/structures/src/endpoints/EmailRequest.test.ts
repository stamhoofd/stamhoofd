import { Language } from '@stamhoofd/types/Language';
import { Recipient } from './EmailRequest.js';

describe('Recipient.merge', () => {
    describe('language', () => {
        it('keeps its own language and ignores the incoming one when set', () => {
            const recipient = Recipient.create({ email: 'test@example.com', language: Language.French });
            recipient.merge(Recipient.create({ email: 'test@example.com', language: Language.Dutch }));
            expect(recipient.language).toBe(Language.French);
        });

        it('takes the incoming language when its own is not set', () => {
            const recipient = Recipient.create({ email: 'test@example.com', language: null });
            recipient.merge(Recipient.create({ email: 'test@example.com', language: Language.Dutch }));
            expect(recipient.language).toBe(Language.Dutch);
        });

        it('stays null when neither has a language', () => {
            const recipient = Recipient.create({ email: 'test@example.com', language: null });
            recipient.merge(Recipient.create({ email: 'test@example.com', language: null }));
            expect(recipient.language).toBeNull();
        });
    });
});
