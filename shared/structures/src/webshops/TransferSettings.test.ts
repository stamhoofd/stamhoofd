import { Country } from '@stamhoofd/types/Country';
import { TransferDescriptionType, TransferSettings } from './TransferSettings.js';

describe('TransferSettings replacements', () => {
    test('replaces once per key in insertion order and appends the reference', () => {
        const settings = TransferSettings.create({ type: TransferDescriptionType.Reference, prefix: '{{name}} {{name}} {{other}}' });
        expect(settings.generateDescription('42', Country.Belgium, new Map([
            ['name', '{{other}}'], ['other', 'Jan'],
        ]))).toBe('Jan {{name}} {{other}} 42');
    });

    test('supports empty values and fixed descriptions without a reference', () => {
        const settings = TransferSettings.create({ type: TransferDescriptionType.Fixed, prefix: '{{name}}/{{empty}}' });
        expect(settings.generateDescription('42', Country.Belgium, new Map([
            ['name', 'Jan'], ['empty', ''],
        ]))).toBe('Jan/');
    });

    test('uses the prefix replacement for Belgian structured descriptions', () => {
        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        try {
            expect(TransferSettings.generateOGM(new Map([['prefix', '1234']]))).toBe('+++000/1234/00063+++');
        }
        finally {
            random.mockRestore();
        }
    });
});
