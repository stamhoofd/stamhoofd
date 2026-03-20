import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import type { AutoTranslateOptions } from '../../types/AutoTranslateOptions.js';
import type { Batch } from '../../types/Batch.js';
import { PromiseQueue } from '../PromiseQueue.js';
import type { TranslationManager } from '../TranslationManager.js';
import { Translator } from './Translator.js';

export class ClaudeTranslator extends Translator {
    protected readonly maxBatchLength = 3000;
    protected readonly queue = new PromiseQueue<Batch<any>>(3, 500);
    protected readonly anthropic: Anthropic;

    constructor(manager: TranslationManager, options: AutoTranslateOptions) {
        super(manager, options);

        this.anthropic = new Anthropic({
            apiKey: 'my_api_key', // defaults to process.env["ANTHROPIC_API_KEY"]
        });

        throw new Error('Not implemented');
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const msg = await this.anthropic.messages.create({
            model: 'claude-3-7-sonnet-20250219',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });

        console.log(chalk.yellow(msg));

        // todo
        return JSON.stringify(msg);
    }
}
