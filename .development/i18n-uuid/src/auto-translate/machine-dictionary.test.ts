import fs from 'fs';
import { afterEach, expect, it, vi } from 'vitest';
import { TranslationManager } from './TranslationManager.js';

afterEach(() => vi.restoreAllMocks());

it('reads machine translation JSON into a map and writes sorted JSON', () => {
    const entries = {
        second: { original: 'Dag', translation: 'Bye' },
        first: { original: 'Hallo', translation: 'Hello' },
    };
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(entries));
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const dictionary = TranslationManager.readTranslationDictionaryAllowNull('machine-en.json');
    expect(dictionary).toEqual(new Map(Object.entries(entries)));
    TranslationManager.prototype.setMachineTranslationDictionary(dictionary!, { locale: 'en', namespace: 'stamhoofd' });

    const output = JSON.parse(write.mock.calls[0][1] as string);
    expect(output).toEqual(entries);
    expect(Object.keys(output)).toEqual(['first', 'second']);
});

it('merges dictionaries with incoming translations taking precedence', () => {
    const current = new Map([['greeting', { original: 'Hallo', translation: 'Hi' }]]);
    const incoming = new Map([['greeting', { original: 'Hallo', translation: 'Hello' }]]);
    const manager = Object.create(TranslationManager.prototype) as TranslationManager;
    vi.spyOn(manager, 'readMachineTranslationDictionary').mockReturnValue(current);
    const save = vi.spyOn(manager, 'setMachineTranslationDictionary').mockImplementation(() => {});

    manager.addMachineTranslationDictionary(incoming, { locale: 'en', namespace: 'stamhoofd' });

    expect(save).toHaveBeenCalledWith(incoming, { locale: 'en', namespace: 'stamhoofd' });
    expect(current.get('greeting')?.translation).toBe('Hi');
});
