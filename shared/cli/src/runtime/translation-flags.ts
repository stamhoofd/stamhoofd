import { Flags } from '@oclif/core';
import type { autoTranslate } from 'i18n-uuid/auto-translate';
import { TranslatorType } from 'i18n-uuid/translator-type';

const providers = {
    'openai': TranslatorType.OpenAi,
    'gemini': TranslatorType.GoogleGemini,
    'mistral-large': TranslatorType.MistralLarge,
    'mistral-small': TranslatorType.MistralSmall,
};

export const machineFlags = {
    provider: Flags.string({ description: 'AI provider (default: openai)', options: Object.keys(providers), default: 'openai' }),
    locale: Flags.string({ description: 'Locale to translate; repeat for multiple locales (default: all non-Dutch locales)', multiple: true }),
    fake: Flags.boolean({ description: 'Generate fake translations without AI requests' }),
};

export function machineArgs(flags: { provider: string; locale?: string[]; fake: boolean }): Parameters<typeof autoTranslate>[0] {
    return {
        translatorType: providers[flags.provider as keyof typeof providers],
        locales: flags.locale,
        fake: flags.fake,
    };
}
