import fs from 'fs';
import { expect, it } from 'vitest';
import { getFilesToSearch, translatableFileTypes } from '../shared/get-files-to-search.js';
import { findEscapedTranslationKeyUsages } from './replace-keys-with-uuid.js';

it('finds literals whose source text differs from the string the code sees', () => {
    expect(findEscapedTranslationKeyUsages(`$t('Foto\\'s')`)).toEqual(new Set([`Foto\\'s`]));
    expect(findEscapedTranslationKeyUsages('$t(`Eerste regel\\nTweede regel`)')).toEqual(new Set(['Eerste regel\\nTweede regel']));
    expect(findEscapedTranslationKeyUsages('$t(\n    "Op een eigen regel\\tgezet",\n)')).toEqual(new Set(['Op een eigen regel\\tgezet']));
});

it('accepts literals that need no escape', () => {
    expect(findEscapedTranslationKeyUsages(`$t('Foto’s')`)).toEqual(new Set());
    expect(findEscapedTranslationKeyUsages('$t(`Eerste regel\nTweede regel`)')).toEqual(new Set());
    expect(findEscapedTranslationKeyUsages(`$t("Foto's")`)).toEqual(new Set());
});

it('has no escaped $t() literals anywhere in the code base', () => {
    const offenders: string[] = [];

    for (const filePath of getFilesToSearch(translatableFileTypes)) {
        for (const key of findEscapedTranslationKeyUsages(fs.readFileSync(filePath, 'utf8'))) {
            offenders.push(`${filePath}: ${key}`);
        }
    }

    expect(offenders).toEqual([]);
});
