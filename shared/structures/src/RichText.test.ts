import { RichText } from './RichText.js';

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
});
