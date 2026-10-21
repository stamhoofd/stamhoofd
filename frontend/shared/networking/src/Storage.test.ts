import { afterEach, describe, expect, test, vi } from 'vitest';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Language } from '@stamhoofd/types/Language';
import { LocalStorage, Storage } from './Storage';

const originalStorage = Storage.keyValue;

afterEach(() => {
    Storage.keyValue = originalStorage;
});

describe('storage adapters', () => {
    test('browser storage supports missing values, writes and removal', async () => {
        const storage = new LocalStorage();
        const key = 'storage-adapter-test';
        expect(await storage.getItem(key)).toBeNull();
        await storage.setItem(key, 'value');
        expect(await storage.getItem(key)).toBe('value');
        await storage.removeItem(key);
        expect(await storage.getItem(key)).toBeNull();
    });

    test('localization reads a replacement adapter installed by bootstrap', async () => {
        const values: Record<string, string> = { language: Language.French, 'i18n-version': '2' };
        Storage.keyValue = {
            getItem: vi.fn(async (key: string) => values[key] ?? null),
            setItem: vi.fn(async () => {}),
            removeItem: vi.fn(async () => {}),
        };

        expect(await I18nController.getLocaleFromStorage()).toEqual({ language: Language.French, country: undefined });
        expect(Storage.keyValue.getItem).toHaveBeenCalledWith('language');
    });
});
