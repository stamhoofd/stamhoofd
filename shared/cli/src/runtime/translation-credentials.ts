import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { TranslatorType } from 'i18n-uuid/translator-type';
import { getProjectPath } from '../context/project-path.js';
import { read1PasswordCli } from './one-password.js';

const credentials = {
    [TranslatorType.OpenAi]: ['OPENAI_API_KEY', 'OpenAI'],
    [TranslatorType.GoogleGemini]: ['GEMINI_API_KEY', 'Gemini'],
    [TranslatorType.MistralLarge]: ['MISTRAL_API_KEY', 'Mistral'],
    [TranslatorType.MistralSmall]: ['MISTRAL_API_KEY', 'Mistral'],
} as const;

export async function resolveTranslationApiKey(provider: Exclude<TranslatorType, TranslatorType.Claude>): Promise<string> {
    const [variable, item] = credentials[provider];
    const environmentKey = process.env[variable]?.trim();
    if (environmentKey) {
        return environmentKey;
    }

    let localEnvironment: NodeJS.Dict<string> = {};
    try {
        localEnvironment = parseEnv(await fs.readFile(path.join(getProjectPath(), '.development/i18n-uuid/.env'), 'utf8'));
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }
    const localKey = localEnvironment[variable]?.trim();
    if (localKey) {
        return localKey;
    }

    const reference = `op://DevOps Development/${item}/Token`;
    const key = (await read1PasswordCli(reference, { optional: false })).trim();
    if (!key) {
        throw new Error(`No translation API key found. Set ${variable} or configure ${reference}.`);
    }
    return key;
}
