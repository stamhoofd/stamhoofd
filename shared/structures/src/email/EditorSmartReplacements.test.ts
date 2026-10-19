import '../circular-dependencies/ExampleReplacementsDependencies.js';
import { Replacement } from '../endpoints/EmailRequest.js';
import { File } from '../files/File.js';
import { EditorSmartButton } from './EditorSmartButton.js';
import { EditorSmartVariable } from './EditorSmartVariable.js';

describe('Email editor replacements', () => {
    describe.each([EditorSmartButton, EditorSmartVariable])('%s.forReplacements', (editor) => {
        it('only includes items with a nonempty replacement, except always-supported links', () => {
            const items = editor.forReplacements([
                Replacement.create({ token: 'resetUrl', value: '' }),
                Replacement.create({ token: 'firstName', value: '' }),
                Replacement.create({ token: 'unknown', value: 'Unknown' }),
            ]);

            expect(items.map(item => item.id)).toEqual(editor === EditorSmartButton ? ['signInUrl', 'unsubscribeUrl'] : []);
        });

        it.each([
            { value: 'Reset link' },
            { html: '<a>Reset link</a>' },
        ])('accepts a replacement with %j', (content) => {
            const items = editor.forReplacements([Replacement.create({ token: 'resetUrl', ...content })]);

            expect(items.some(item => item.id === 'resetUrl')).toBe(true);
        });
    });

    describe('EditorSmartVariable.fillExamples', () => {
        it('fills text examples and clears previous HTML', () => {
            const variable = EditorSmartVariable.create({ id: 'firstName', name: 'First name', html: '<p>Old</p>' });

            expect(EditorSmartVariable.fillExamples([variable], [Replacement.create({ token: 'firstName', value: 'Alex' })])).toEqual([variable]);
            expect(variable.example).toBe('Alex');
            expect(variable.html).toBeUndefined();
        });

        it('prefers HTML over text, resolves inline images and clears previous examples', () => {
            const file = new File({
                id: 'image-1',
                server: 'https://files.example.com',
                path: 'photo.jpg',
                size: 100,
            });
            const variable = EditorSmartVariable.create({ id: 'orderTable', name: 'Order', example: 'Old' });
            const replacement = Replacement.create({
                token: 'orderTable',
                value: 'Fallback',
                html: `<img src="${file.inlineEmailSrc}">`,
                files: [file],
            });

            EditorSmartVariable.fillExamples([variable], [replacement]);

            expect(variable.html).toBe('<img src="https://files.example.com/photo.jpg">');
            expect(variable.example).toBe('');
            expect(replacement.html).toContain(file.inlineEmailSrc);
        });

        it('uses the first nonempty replacement for a token', () => {
            const variable = EditorSmartVariable.create({ id: 'firstName', name: 'First name' });

            EditorSmartVariable.fillExamples([variable], [
                Replacement.create({ token: 'firstName' }),
                Replacement.create({ token: 'firstName', value: 'Alex' }),
                Replacement.create({ token: 'firstName', value: 'Sam' }),
            ]);

            expect(variable.example).toBe('Alex');
        });

        it.each(['signInUrl', 'unsubscribeUrl'])('keeps %s without filling its example', (id) => {
            const variable = EditorSmartVariable.create({ id, name: 'Link', example: 'Default' });

            expect(EditorSmartVariable.fillExamples([variable], [])).toEqual([variable]);
            expect(EditorSmartVariable.fillExamples([variable], [Replacement.create({ token: id, value: 'https://example.com' })])).toEqual([variable]);
            expect(variable.example).toBe('Default');
        });
    });

    describe('balance visibility', () => {
        it.each([
            { value: '€10' },
            { html: '<strong>€10</strong>' },
        ])('hides outstandingBalance when priceToPay has %j', (content) => {
            const variables = EditorSmartVariable.forReplacements([
                Replacement.create({ token: 'outstandingBalance', value: '€20' }),
                Replacement.create({ token: 'priceToPay', ...content }),
            ]);

            expect(variables.map(variable => variable.id)).toEqual(['priceToPay']);
        });

        it('keeps outstandingBalance when priceToPay is empty', () => {
            const variables = EditorSmartVariable.forReplacements([
                Replacement.create({ token: 'outstandingBalance', value: '€20' }),
                Replacement.create({ token: 'priceToPay' }),
            ]);

            expect(variables.map(variable => variable.id)).toEqual(['outstandingBalance']);
        });
    });

    describe('payment buttons', () => {
        it.each([
            { value: 'Payment overview' },
            { html: '<table></table>' },
        ])('renames the payment button when paymentTable has %j', (content) => {
            const buttons = EditorSmartButton.forReplacements([
                Replacement.create({ token: 'paymentUrl', value: 'https://example.com/pay' }),
                Replacement.create({ token: 'paymentTable', ...content }),
            ]);

            expect(buttons.find(button => button.id === 'paymentUrl')).toMatchObject({
                text: $t('%1Mw'),
                name: $t('%1Mx'),
                hint: $t('%1My'),
            });
        });

        it('does not rename the payment button for an empty payment table', () => {
            const buttons = EditorSmartButton.forReplacements([
                Replacement.create({ token: 'paymentUrl', value: 'https://example.com/pay' }),
                Replacement.create({ token: 'paymentTable' }),
            ]);

            expect(buttons.find(button => button.id === 'paymentUrl')).toEqual(EditorSmartButton.all.find(button => button.id === 'paymentUrl'));
        });

        it('does not offer the payment button without a payment URL', () => {
            const buttons = EditorSmartButton.forReplacements([Replacement.create({ token: 'paymentTable', html: '<table></table>' })]);

            expect(buttons.map(button => button.id)).toEqual(['signInUrl', 'unsubscribeUrl']);
        });
    });

    it('does not leak variable examples or button labels between calls', () => {
        const variables = EditorSmartVariable.all;
        const buttons = EditorSmartButton.all;
        const replacements = [
            Replacement.create({ token: 'firstName', value: 'Custom name' }),
            Replacement.create({ token: 'paymentUrl', value: 'https://example.com/pay' }),
            Replacement.create({ token: 'paymentTable', html: '<table></table>' }),
        ];

        const first = EditorSmartVariable.forReplacements(replacements);
        const second = EditorSmartVariable.forReplacements(replacements);
        expect(first.find(variable => variable.id === 'firstName')).not.toBe(second.find(variable => variable.id === 'firstName'));
        EditorSmartButton.forReplacements(replacements);

        expect(EditorSmartVariable.all).toEqual(variables);
        expect(EditorSmartButton.all).toEqual(buttons);
    });
});
