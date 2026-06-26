import { ClaudeTranslationModel, DEFAULT_CLAUDE_MODEL } from './claude-translation-model.js';
import { DEFAULT_OPENAI_MODEL, OpenAITranslationModel } from './openai-translation-model.js';
import type { TranslationModel } from './translation-model.js';
import { read1PasswordCli } from '../one-password.js';

export type TranslationProvider = 'openai' | 'claude';

export const DEFAULT_TRANSLATION_PROVIDER: TranslationProvider = 'openai';

export type ResolveTranslationModelOptions = {
    /** Override the provider; defaults to RELEASE_NOTES_AI_PROVIDER or "openai". */
    provider?: string;
    /** Override the model; defaults to RELEASE_NOTES_AI_MODEL or the provider's default. */
    model?: string;
};

/** Either a ready-to-use model, or a reason it is unavailable so the caller can skip gracefully. */
export type TranslationModelResolution
    = | { model: TranslationModel }
        | { unavailable: string };

/**
 * Picks the configured translation backend. Returns `{ unavailable }` (rather than throwing)
 * when the provider's API key is missing, so release-note generation degrades gracefully to
 * the English-only notes.
 */
export async function resolveTranslationModel(options: ResolveTranslationModelOptions = {}): Promise<TranslationModelResolution> {
    const provider = (options.provider ?? process.env.RELEASE_NOTES_AI_PROVIDER ?? DEFAULT_TRANSLATION_PROVIDER).toLowerCase();
    const model = options.model ?? process.env.RELEASE_NOTES_AI_MODEL;

    if (provider === 'openai') {
        if (!process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = await read1PasswordCli('op://DevOps Development/OpenAI/token', {
                optional: false,
            });
        }
        return { model: new OpenAITranslationModel(model ?? DEFAULT_OPENAI_MODEL) };
    }

    if (provider === 'claude' || provider === 'anthropic') {
        if (!process.env.ANTHROPIC_API_KEY) {
            return { unavailable: 'ANTHROPIC_API_KEY is not set' };
        }
        return { model: new ClaudeTranslationModel(model ?? DEFAULT_CLAUDE_MODEL) };
    }

    return { unavailable: `Unknown translation provider "${provider}" (expected "openai" or "claude")` };
}
