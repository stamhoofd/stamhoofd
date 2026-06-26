import OpenAI from 'openai';
import { COMMIT_DIFF_TOOL, GREP_TOOL, MAX_TOOL_ITERATIONS } from './translation-model.js';
import type { TranslationModel, TranslationRequest } from './translation-model.js';

export const DEFAULT_OPENAI_MODEL = 'gpt-5.5';

/**
 * OpenAI-backed translation model. Uses chat completions with function calling so the model
 * can request a commit diff mid-translation. This is the active backend; swap to Claude by
 * setting RELEASE_NOTES_AI_PROVIDER=claude (see ClaudeTranslationModel).
 */
export class OpenAITranslationModel implements TranslationModel {
    readonly name: string;
    private readonly client: OpenAI;
    private readonly model: string;

    constructor(model: string = DEFAULT_OPENAI_MODEL, client?: OpenAI) {
        this.model = model;
        this.name = `openai:${model}`;
        this.client = client ?? new OpenAI();
    }

    async translate(request: TranslationRequest): Promise<string> {
        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [COMMIT_DIFF_TOOL, GREP_TOOL].map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userContent },
        ];

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages,
                tools,
            });

            const message = response.choices[0]?.message;
            if (!message) {
                throw new Error('OpenAI returned no message');
            }
            messages.push(message);

            const toolCalls = message.tool_calls ?? [];
            if (toolCalls.length === 0) {
                return message.content ?? '';
            }

            for (const toolCall of toolCalls) {
                const content = await this.runToolCall(toolCall, request);
                messages.push({ role: 'tool', tool_call_id: toolCall.id, content });
            }
        }

        throw new Error(`Translation did not finish within ${MAX_TOOL_ITERATIONS} tool iterations`);
    }

    private async runToolCall(
        toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
        request: TranslationRequest,
    ): Promise<string> {
        if (toolCall.type !== 'function') {
            return 'Unknown tool type (expected a function call).';
        }
        const input = parseArguments(toolCall.function.arguments);
        request.onToolCall?.({ name: toolCall.function.name, input });

        if (toolCall.function.name === COMMIT_DIFF_TOOL.name) {
            const hash = typeof input.hash === 'string' ? input.hash : '';
            return await request.fetchCommitDiff(hash);
        }
        if (toolCall.function.name === GREP_TOOL.name) {
            return await request.grepCodebase(input);
        }
        return `Unknown tool: ${toolCall.function.name}`;
    }
}

function parseArguments(rawArguments: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(rawArguments) as unknown;
        return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
        return {};
    }
}
