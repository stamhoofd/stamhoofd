import { describe, expect, it } from 'vitest';
import { markdownToSlack } from './markdown-to-slack.js';

describe('markdownToSlack', () => {
    it('turns ATX headings into bold lines, keeping the emoji', () => {
        expect(markdownToSlack('### 🐛 Bug fixes')).toBe('*🐛 Bug fixes*');
        expect(markdownToSlack('# Title')).toBe('*Title*');
    });

    it('strips closing hashes from headings', () => {
        expect(markdownToSlack('## Heading ##')).toBe('*Heading*');
    });

    it('converts **bold** and __bold__ to *bold*', () => {
        expect(markdownToSlack('**Full changelog**: x')).toBe('*Full changelog*: x');
        expect(markdownToSlack('__strong__')).toBe('*strong*');
    });

    it('rewrites markdown links to Slack link syntax', () => {
        expect(markdownToSlack('See [the docs](https://example.com/x)')).toBe('See <https://example.com/x|the docs>');
    });

    it('converts unordered list markers to bullets and keeps indentation', () => {
        expect(markdownToSlack('- item')).toBe('• item');
        expect(markdownToSlack('* item')).toBe('• item');
        expect(markdownToSlack('+ item')).toBe('• item');
        expect(markdownToSlack('  - nested')).toBe('  • nested');
    });

    it('applies inline transforms inside list items', () => {
        expect(markdownToSlack('- **Foo** added by [a](https://u)')).toBe('• *Foo* added by <https://u|a>');
    });

    it('replaces horizontal rules with a visible divider', () => {
        const divider = '────────────────';
        expect(markdownToSlack('---')).toBe(divider);
        expect(markdownToSlack('***')).toBe(divider);
        expect(markdownToSlack('- - -')).toBe(divider);
    });

    it('leaves italic and bare URLs untouched (already valid Slack mrkdwn)', () => {
        expect(markdownToSlack('_Released on June 26, 2026_')).toBe('_Released on June 26, 2026_');
        expect(markdownToSlack('https://github.com/x/y/compare/v1...v2')).toBe('https://github.com/x/y/compare/v1...v2');
    });

    it('does not rewrite markdown inside inline code spans', () => {
        expect(markdownToSlack('use `**not bold**` here')).toBe('use `**not bold**` here');
    });

    it('passes fenced code blocks through verbatim', () => {
        const input = '```\n- not a bullet\n**not bold**\n```';
        expect(markdownToSlack(input)).toBe(input);
    });

    it('converts a full release-notes block end to end', () => {
        const input = [
            '_Released on June 26, 2026_',
            '',
            '### 🐛 Bug fixes',
            '- Fixed the thing (abc1234) — @octocat',
            '',
            '**Full changelog**: https://github.com/x/y/compare/v1...v2',
            '',
            '---',
            '',
            '### 🐛 Opgelost',
            '- We hebben iets opgelost',
        ].join('\n');

        const expected = [
            '_Released on June 26, 2026_',
            '',
            '*🐛 Bug fixes*',
            '• Fixed the thing (abc1234) — @octocat',
            '',
            '*Full changelog*: https://github.com/x/y/compare/v1...v2',
            '',
            '────────────────',
            '',
            '*🐛 Opgelost*',
            '• We hebben iets opgelost',
        ].join('\n');

        expect(markdownToSlack(input)).toBe(expected);
    });
});
