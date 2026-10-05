import { setImmediate } from 'node:timers/promises';

export type TranslationProgress = {
    phase: 'scan' | 'replace' | 'compare' | 'build' | 'translate' | 'cleanup';
    completed?: number;
    total?: number;
    locale?: string;
    namespace?: string;
    translationFile?: string;
    overallCompleted?: number;
    overallTotal?: number;
};

export type ProgressCallback = (progress: TranslationProgress) => void;

export async function reportProgress(onProgress: ProgressCallback | undefined, progress: TranslationProgress) {
    if (progress.phase === 'cleanup' || progress.completed === undefined || progress.completed % 25 === 0 || progress.completed === progress.total) {
        onProgress?.(progress);
        // Yield to terminal animation and cancellation while processing synchronous batches.
        await setImmediate();
    }
}
