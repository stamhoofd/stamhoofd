import { inTranslationDirectory } from './translate.js';
import type { replaceText } from 'i18n-uuid/replace-text';
import type { autoTranslate } from 'i18n-uuid/auto-translate';

export async function translateText(args: Parameters<typeof replaceText>[0]): Promise<void> {
    await inTranslationDirectory(async () => {
        const { replaceText } = await import('i18n-uuid/replace-text');
        await replaceText(args);
    });
}

export async function translateAutomatically(args: Parameters<typeof autoTranslate>[0]): Promise<void> {
    await inTranslationDirectory(async () => {
        const { autoTranslate } = await import('i18n-uuid/auto-translate');
        await autoTranslate(args);
    });
}

export async function replaceKeysOnce(): Promise<void> {
    await inTranslationDirectory(async () => {
        const { replaceKeys } = await import('i18n-uuid/replace-keys');
        replaceKeys();
    });
}

export async function clearTranslationCache(): Promise<void> {
    await inTranslationDirectory(async () => {
        const { fileCache } = await import('i18n-uuid/file-cache');
        console.log('start clear cache...');
        fileCache.clear();
        console.log('cleared cache');
    });
}

export async function compressUuids(): Promise<void> {
    await inTranslationDirectory(async () => {
        const { compressUuids } = await import('i18n-uuid/compress-uuids');
        compressUuids();
    });
}

export async function filterInvalidAutoTranslations(dryRun: boolean): Promise<void> {
    await inTranslationDirectory(async () => {
        const { filterInvalidAutoTranslations } = await import('i18n-uuid/post-validator');
        filterInvalidAutoTranslations({ dryRun });
    });
}

export async function loopInvalidAutoTranslations(dryRun: boolean): Promise<void> {
    await inTranslationDirectory(async () => {
        const { loopAndPromptValidateInvalidTranslations } = await import('i18n-uuid/post-validator');
        await loopAndPromptValidateInvalidTranslations({ dryRun });
    });
}

export async function fixDoubleTranslations(): Promise<void> {
    await inTranslationDirectory(async () => {
        const { fixDoubleTranslations } = await import('i18n-uuid/fix-double-translations');
        fixDoubleTranslations();
    });
}

export async function createTranslationComparison(): Promise<void> {
    await inTranslationDirectory(async () => {
        const { createAutoTranslateComparison } = await import('i18n-uuid/create-comparison');
        createAutoTranslateComparison();
    });
}
