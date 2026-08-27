import type { Decoder } from '@simonbackx/simple-encoding';
import { TranslateResponse } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import type { TranslateRequest } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import { useContext } from '#hooks/useContext.ts';

export type EmailTranslator = (request: TranslateRequest) => Promise<TranslateResponse>;

/**
 * Calls the AI translation endpoint (only available to full platform admins).
 */
export function useEmailTranslator(): EmailTranslator {
    const context = useContext();

    return async (request: TranslateRequest) => {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/translate',
            body: request,
            decoder: TranslateResponse as Decoder<TranslateResponse>,
            shouldRetry: false,
            timeout: 120_000,
        });
        return response.data;
    };
}
