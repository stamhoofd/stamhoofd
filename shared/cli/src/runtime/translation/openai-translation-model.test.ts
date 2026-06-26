import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { OpenAITranslationModel } from './openai-translation-model.js';

/** Minimal fake of the OpenAI client exposing chat.completions.create. */
function fakeClient(responses: OpenAI.Chat.Completions.ChatCompletion[]): { client: OpenAI; create: ReturnType<typeof vi.fn> } {
    const create = vi.fn();
    for (const response of responses) {
        create.mockResolvedValueOnce(response);
    }
    return { client: { chat: { completions: { create } } } as unknown as OpenAI, create };
}

function completion(message: OpenAI.Chat.Completions.ChatCompletionMessage): OpenAI.Chat.Completions.ChatCompletion {
    return { choices: [{ message }] } as OpenAI.Chat.Completions.ChatCompletion;
}

describe('OpenAITranslationModel', () => {
    it('returns the assistant content when no tool is called', async () => {
        const { client, create } = fakeClient([
            completion({ role: 'assistant', content: '## Wat is er veranderd?', refusal: null }),
        ]);
        const model = new OpenAITranslationModel('gpt-4.1', client);

        const result = await model.translate({ systemPrompt: 'sys', userContent: 'notes', fetchCommitDiff: async () => '', grepCodebase: async () => '' });

        expect(result).toBe('## Wat is er veranderd?');
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('resolves a get_commit_diff tool call and feeds the diff back', async () => {
        const { client, create } = fakeClient([
            completion({
                role: 'assistant',
                content: null,
                refusal: null,
                tool_calls: [{
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'get_commit_diff', arguments: JSON.stringify({ hash: 'abc123' }) },
                }],
            }),
            completion({ role: 'assistant', content: 'Done', refusal: null }),
        ]);
        const model = new OpenAITranslationModel('gpt-4.1', client);
        const fetchCommitDiff = vi.fn(async () => 'the diff');
        const onToolCall = vi.fn();

        const result = await model.translate({ systemPrompt: 'sys', userContent: 'notes', fetchCommitDiff, grepCodebase: async () => '', onToolCall });

        expect(result).toBe('Done');
        expect(fetchCommitDiff).toHaveBeenCalledWith('abc123');
        expect(onToolCall).toHaveBeenCalledWith({ name: 'get_commit_diff', input: { hash: 'abc123' } });

        // The second call must include the tool result so the model can use it.
        const secondCallMessages = create.mock.calls[1][0].messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        const toolMessage = secondCallMessages.find(m => m.role === 'tool');
        expect(toolMessage).toMatchObject({ role: 'tool', tool_call_id: 'call_1', content: 'the diff' });
    });

    it('resolves a grep_codebase tool call and feeds the matches back', async () => {
        const { client, create } = fakeClient([
            completion({
                role: 'assistant',
                content: null,
                refusal: null,
                tool_calls: [{
                    id: 'call_2',
                    type: 'function',
                    function: { name: 'grep_codebase', arguments: JSON.stringify({ pattern: 'Opslaan', commit: 'abc123' }) },
                }],
            }),
            completion({ role: 'assistant', content: 'Done', refusal: null }),
        ]);
        const model = new OpenAITranslationModel('gpt-4.1', client);
        const grepCodebase = vi.fn(async () => 'src/App.vue:3:Opslaan');
        const onToolCall = vi.fn();

        const result = await model.translate({ systemPrompt: 'sys', userContent: 'notes', fetchCommitDiff: async () => '', grepCodebase, onToolCall });

        expect(result).toBe('Done');
        expect(grepCodebase).toHaveBeenCalledWith({ pattern: 'Opslaan', commit: 'abc123' });
        expect(onToolCall).toHaveBeenCalledWith({ name: 'grep_codebase', input: { pattern: 'Opslaan', commit: 'abc123' } });

        const secondCallMessages = create.mock.calls[1][0].messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        const toolMessage = secondCallMessages.find(m => m.role === 'tool');
        expect(toolMessage).toMatchObject({ role: 'tool', tool_call_id: 'call_2', content: 'src/App.vue:3:Opslaan' });
    });
});
