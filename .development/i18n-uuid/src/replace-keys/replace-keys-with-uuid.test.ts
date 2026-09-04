import { findTranslationKeyUsages, replaceOccurrencesInContent } from './replace-keys-with-uuid.js';

describe('replace-keys-with-uuid', () => {
    describe('findTranslationKeyUsages', () => {
        test('finds keys in TypeScript and Vue syntax', () => {
            const content = `
                const a = $t('Opslaan');
                const b = $t("Annuleren");
                const c = $t(\`Verwijderen\`);
                const d = $t('Welkom {firstName},', { firstName: 'Simon' });
                const e = $t('%abc');
            `;

            expect(findTranslationKeyUsages(content)).toEqual(new Set(['Opslaan', 'Annuleren', 'Verwijderen', 'Welkom {firstName},', '%abc']));
        });

        test('finds keys in Handlebars syntax', () => {
            const content = `
                <title>{{#if isReceipt}}{{$t "Aankoopbewijs"}}{{else}}{{$t "Factuur"}}{{/if}}</title>
                <p>{{ $t "T.a.v. "}} {{invoice.customer.contactName}}</p>
                <p>{{$t 'Datum'}}</p>
                content: "{{$t " Pagina"}} " counter(page);
                <span>{{$t "%1Ab"}}</span>
            `;

            expect(findTranslationKeyUsages(content)).toEqual(new Set(['Aankoopbewijs', 'Factuur', 'T.a.v. ', 'Datum', ' Pagina', '%1Ab']));
        });

        test('ignores other helpers and plain text', () => {
            const content = `{{formatPrice total}} {{t "not a translation"}} $translate("x")`;
            expect(findTranslationKeyUsages(content).size).toBe(0);
        });
    });

    describe('replaceOccurrencesInContent', () => {
        const replacedKeys = new Map([
            ['Factuur', '%1'],
            ['BTW %', '%2'],
            ['T.a.v. ', '%3'],
        ]);

        test('replaces keys in TypeScript and Vue syntax', () => {
            const content = `$t('Factuur') $t("Factuur") $t(\`Factuur\`) $t('BTW %') $t('Factuur voor')`;
            expect(replaceOccurrencesInContent(content, replacedKeys)).toBe(`$t('%1') $t("%1") $t(\`%1\`) $t('%2') $t('Factuur voor')`);
        });

        test('replaces keys in Handlebars syntax and keeps whitespace', () => {
            const content = `{{$t "Factuur"}} {{ $t "T.a.v. "}} {{$t 'BTW %'}} <th>{{$t "BTW %"}}</th> {{$t "Factuur voor"}}`;
            expect(replaceOccurrencesInContent(content, replacedKeys)).toBe(`{{$t "%1"}} {{ $t "%3"}} {{$t '%2'}} <th>{{$t "%2"}}</th> {{$t "Factuur voor"}}`);
        });

        test('replaces every occurrence', () => {
            const content = `{{$t "Factuur"}} and {{$t "Factuur"}}`;
            expect(replaceOccurrencesInContent(content, replacedKeys)).toBe(`{{$t "%1"}} and {{$t "%1"}}`);
        });
    });
});
