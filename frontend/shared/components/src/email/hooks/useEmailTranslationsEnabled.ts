import { useAppContext } from '#context/appContext.ts';
import { useFeatureFlag } from '#hooks/useFeatureFlag.ts';
import type { ComputedRef } from 'vue';
import { computed } from 'vue';

/**
 * Whether the UI for *adding* translations to emails and email templates should be shown.
 *
 * Hidden by default, and enabled per organization through the 'email-translations' feature flag.
 * The admin app always enables it. Content that already has translations must stay manageable, so
 * callers keep showing the translation UI whenever translations already exist, regardless of this.
 */
export function useEmailTranslationsEnabled(): ComputedRef<boolean> {
    const app = useAppContext();
    const getFeatureFlag = useFeatureFlag();

    return computed(() => {
        if (app === 'admin') {
            return true;
        }
        return getFeatureFlag('email-translations');
    });
}
