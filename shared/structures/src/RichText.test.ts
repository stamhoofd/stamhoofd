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
