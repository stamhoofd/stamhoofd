import type { ProgressCallback, TranslationProgress } from 'i18n-uuid/progress';
import { step } from './ux.js';
import path from 'node:path';

export function formatTranslationProgress(progress: TranslationProgress): string {
    const labels = {
        scan: 'Scanning source files',
        replace: 'Updating source files',
        compare: 'Comparing translation keys',
        build: 'Building locales',
        translate: 'Translating batches',
        cleanup: 'Cleaning translation files',
    };
    const scope = progress.translationFile ? path.basename(progress.translationFile) : [progress.namespace, progress.locale].filter(Boolean).join('/');
    const counts = progress.total === undefined ? '' : ` ${progress.completed ?? 0}/${progress.total}`;
    const overall = progress.overallTotal ? `Overall ${Math.floor((progress.overallCompleted ?? 0) * 100 / progress.overallTotal)}% — ` : '';
    return `${overall}${labels[progress.phase]}${scope ? ` (${scope})` : ''}${counts}`;
}

export async function translationStep<T>(message: string, action: (onProgress: ProgressCallback) => Promise<T>, successMessage?: (result: T) => string): Promise<T> {
    return await step(message, async update => await action(progress => update(`${message} — ${formatTranslationProgress(progress)}`)), { successMessage });
}
