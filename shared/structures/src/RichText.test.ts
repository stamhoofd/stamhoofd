import { ObjectData } from '@common/encoding';
import { describe, expect, it } from 'vitest';

import { RichText } from './RichText.js';
import { Version } from './Version.js';

describe('RichText.json', () => {
    it('is empty for content stored before the field existed', () => {
        expect(new ObjectData({ html: '<p>Hallo</p>', text: 'Hallo' }, { version: Version }).decode(RichText).json).toEqual({});
    });

    it('keeps the editor document through an encode and decode', () => {
        const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hallo' }] }] };
        const richText = RichText.create({ html: '<p>Hallo</p>', text: 'Hallo', json });

        const decoded = new ObjectData(richText.encode({ version: Version }), { version: Version }).decode(RichText);
        expect(decoded.json).toEqual(json);
    });
});

describe('RichText.fromText', () => {
    it('wraps every line in a paragraph', () => {
        const richText = RichText.fromText('Eerste regel\nTweede regel');
        expect(richText.text).toBe('Eerste regel\nTweede regel');
        expect(richText.html).toBe('<p>Eerste regel</p><p>Tweede regel</p>');
    });

    it('escapes HTML', () => {
        expect(RichText.fromText('<b>a & b</b>').html).toBe('<p>&lt;b&gt;a &amp; b&lt;/b&gt;</p>');
    });

    it('keeps an empty text as one empty paragraph', () => {
        expect(RichText.fromText('').html).toBe('<p></p>');
    });

    it('builds a document with a paragraph per line', () => {
        expect(RichText.fromText('Eerste regel\nTweede regel').json).toEqual({
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Eerste regel' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Tweede regel' }] },
            ],
        });
    });

    it('keeps an empty line as an empty paragraph', () => {
        expect(RichText.fromText('Eerste regel\n\nDerde regel').json.content).toEqual([
            { type: 'paragraph', content: [{ type: 'text', text: 'Eerste regel' }] },
            { type: 'paragraph' },
            { type: 'paragraph', content: [{ type: 'text', text: 'Derde regel' }] },
        ]);
    });

    it('does not escape the text of a text node, only the html', () => {
        const richText = RichText.fromText('<b>a & b</b>');
        expect(richText.json.content[0].content[0].text).toBe('<b>a & b</b>');
        expect(richText.html).toBe('<p>&lt;b&gt;a &amp; b&lt;/b&gt;</p>');
    });
});
