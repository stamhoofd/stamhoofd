import nock from 'nock';
import { resetNock } from './resetNock.js';

export type OpenAIChatRequest = {
    model: string;
    messages: { role: string; content: string }[];
};

export type OpenAIResponder = (request: OpenAIChatRequest) => unknown;

/**
 * Mocks the OpenAI chat completions endpoint. The default responder mirrors the "inputs" of the
 * user message back as translations, prefixed with the target language, so tests can assert the
 * full request/response flow without a real model.
 */
export class OpenAIMocker {
    requests: OpenAIChatRequest[] = [];

    #responder: OpenAIResponder | null = null;
    #forceFailure = false;

    reset() {
        this.requests = [];
        this.#responder = null;
        this.#forceFailure = false;
    }

    /**
     * Override what the assistant message content will be (serialized as JSON).
     */
    respondWith(responder: OpenAIResponder) {
        this.#responder = responder;
    }

    forceFailure() {
        this.#forceFailure = true;
    }

    static defaultResponder(request: OpenAIChatRequest): unknown {
        const userMessage = request.messages.find(m => m.role === 'user');
        const body = JSON.parse(userMessage?.content ?? '{}') as { targetLanguage: string; inputs: Record<string, unknown> };
        const translations: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(body.inputs)) {
            translations[key] = OpenAIMocker.translateValue(value, body.targetLanguage);
        }
        return { translations };
    }

    private static translateValue(value: unknown, language: string): unknown {
        if (typeof value === 'string') {
            return `[${language}] ${value}`;
        }
        if (Array.isArray(value)) {
            return value.map(v => this.translateValue(v, language));
        }
        if (typeof value === 'object' && value !== null) {
            const copy: Record<string, unknown> = {};
            for (const [key, v] of Object.entries(value)) {
                copy[key] = key === 'text' ? this.translateValue(v, language) : (typeof v === 'object' ? this.translateValue(v, language) : v);
            }
            return copy;
        }
        return value;
    }

    start() {
        nock('https://api.openai.com')
            .persist()
            .post('/v1/chat/completions')
            .reply((uri: string, requestBody: nock.Body) => {
                if (this.#forceFailure) {
                    return [500, { error: { message: 'Forced failure' } }];
                }

                const request = (typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody) as OpenAIChatRequest;
                this.requests.push(request);

                const output = (this.#responder ?? OpenAIMocker.defaultResponder)(request);
                return [200, {
                    id: 'chatcmpl-test',
                    object: 'chat.completion',
                    created: 0,
                    model: request.model,
                    choices: [{
                        index: 0,
                        message: { role: 'assistant', content: typeof output === 'string' ? output : JSON.stringify(output) },
                        finish_reason: 'stop',
                    }],
                }];
            });
    }

    stop() {
        this.reset();
        resetNock();
    }

    get lastRequest(): OpenAIChatRequest | undefined {
        return this.requests[this.requests.length - 1];
    }
}
