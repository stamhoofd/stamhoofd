import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import noRichTextInterpolation from '../src/rules/no-rich-text-interpolation.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parser: tseslint.parser,
        parserOptions: {
            projectService: {
                allowDefaultProject: ['rich-text.test.ts'],
            },
            tsconfigRootDir: import.meta.dirname,
        },
    },
});

const declarations = `
    class RichText { html = ''; text = ''; toString() { return this.text; } }
    class TranslatedRichText { get html() { return ''; } get text() { return ''; } toString() { return this.text; } }
    class TranslatedText { toString() { return ''; } }
    const richText = new RichText();
    const translated = new TranslatedRichText();
    const plain = new TranslatedText();
    const count = 2;
`;

function source(body) {
    return { filename: 'rich-text.test.ts', code: declarations + body };
}

function invalid(body) {
    return { ...source(body), errors: [{ messageId: 'noRichTextInterpolation' }] };
}

ruleTester.run('no-rich-text-interpolation', noRichTextInterpolation, {
    valid: [
        source('const a = `Tekst: ${translated.text}`;'),
        source('const b = `Tekst: ${richText.text}`;'),
        source('const c = `Naam: ${plain}`;'),
        source('const d = `Aantal: ${count}`;'),
        source('const e = count + 1;'),
        source('const f = translated.html;'),
        source("const g = 'Tekst: ' + translated.text;"),
    ],
    invalid: [
        invalid('const a = `Tekst: ${translated}`;'),
        invalid('const b = `Tekst: ${richText}`;'),
        invalid("const c = 'Tekst: ' + translated;"),
        invalid("const d = translated + '';"),
        invalid('const e = `Tekst: ${translated as TranslatedRichText}`;'),
        {
            ...source('const f = `${translated} en ${richText}`;'),
            errors: [{ messageId: 'noRichTextInterpolation' }, { messageId: 'noRichTextInterpolation' }],
        },
    ],
});
