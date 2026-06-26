import Anthropic from '@anthropic-ai/sdk';
import { COMMIT_DIFF_TOOL, GREP_TOOL, MAX_TOOL_ITERATIONS } from './translation-model.js';
import type { TranslationModel, TranslationRequest } from './translation-model.js';

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-8';

/**
 * Claude-backed translation model. Not the default today (OpenAI translates these notes slightly
 * better), but wired up so switching is a config change: RELEASE_NOTES_AI_PROVIDER=claude.
 * Uses the Messages API tool-use loop so the model can request a commit diff mid-translation.
 */
export class ClaudeTranslationModel implements TranslationModel {
    readonly name: string;
    private readonly client: Anthropic;
    private readonly model: string;

    constructor(model: string = DEFAULT_CLAUDE_MODEL, client?: Anthropic) {
        this.model = model;
        this.name = `claude:${model}`;
        this.client = client ?? new Anthropic();
    }

    async translate(request: TranslationRequest): Promise<string> {
        const tools: Anthropic.Tool[] = [COMMIT_DIFF_TOOL, GREP_TOOL].map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters,
        }));

        const messages: Anthropic.MessageParam[] = [{ role: 'user', content: request.userContent }];

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 8000,
                system: request.systemPrompt,
                tools,
                messages,
            });

            // Echo the full assistant content (incl. any thinking blocks) back on the next turn.
            messages.push({ role: 'assistant', content: response.content });

            if (response.stop_reason !== 'tool_use') {
                return extractText(response.content);
            }

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of response.content) {
                if (block.type !== 'tool_use') {
                    continue;
                }
                const input = (block.input ?? {}) as Record<string, unknown>;
                request.onToolCall?.({ name: block.name, input });
                const content = await this.runToolCall(block.name, input, request);
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content });
            }
            messages.push({ role: 'user', content: toolResults });
        }

        throw new Error(`Translation did not finish within ${MAX_TOOL_ITERATIONS} tool iterations`);
    }

    private async runToolCall(name: string, input: Record<string, unknown>, request: TranslationRequest): Promise<string> {
        if (name === COMMIT_DIFF_TOOL.name) {
            const hash = typeof input.hash === 'string' ? input.hash : '';
            return await request.fetchCommitDiff(hash);
        }
        if (name === GREP_TOOL.name) {
            return await request.grepCodebase(input);
        }
        return `Unknown tool: ${name}`;
    }
}

function extractText(content: Anthropic.ContentBlock[]): string {
    return content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');
}
