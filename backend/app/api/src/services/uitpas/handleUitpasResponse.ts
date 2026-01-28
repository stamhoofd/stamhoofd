import { SimpleError } from '@simonbackx/simple-errors';

type UitpasErrorResponse = {
    type: string;
    title: string;
    endUserMessage?: {
        nl: string;
    };
};

/**
 * Throws a SimpleError if the response is not ok
 * @param response
 * @returns json
 */
export async function handleUitpasResponse(response: Response) {
    if (response.ok) {
        const json = await response.json();
        return json;
    }

    const error = await uitpasErrorToSimpleError(response);
    throw error;
}

async function uitpasErrorToSimpleError(response: Response) {
    const json: unknown = await response.json().catch(() => { /* ignore */ });
    console.error('[UITPAS ERROR]', json);

    const statusCode = response.status;
    let human: string | undefined;
    let message: string | undefined;
    let code: string | undefined;

    if (json) {
        const uitpasError = jsonToUitpasErrorResponse(json);
        if (uitpasError.endUserMessage) {
            human = uitpasError.endUserMessage.nl;
        }
        message = uitpasError.title;
        code = uitpasError.type;
    }

    return new SimpleError({
        statusCode,
        code: code ?? 'get-uitpas-error',
        message: message ?? `Error when retrieving pass by UiTPAS number`,
        human: human ?? $t('We konden UiTPAS niet bereiken om jouw UiTPAS-nummer te valideren. Probeer het later opnieuw.'),
    });
}

function jsonToUitpasErrorResponse(json: unknown): UitpasErrorResponse {
    assertValidUitpasError(json);
    return {
        type: json.type,
        title: json.title,
        endUserMessage: json.endUserMessage
            ? {
                    nl: json.endUserMessage.nl,
                }
            : undefined,
    };
}

function assertValidUitpasError(json: unknown): asserts json is UitpasErrorResponse {
    if (json === null || typeof json !== 'object') {
        throw new Error('Not an object');
    }

    const stringProperties = ['title', 'type'];

    stringProperties.forEach((key) => {
        if (typeof json[key] !== 'string') {
            throw new Error(`Invalid ${key}`);
        }
    });

    const endUserMessage = json['endUserMessage'];
    if (endUserMessage !== undefined) {
        if (typeof endUserMessage !== 'object' || endUserMessage === null) {
            throw new Error('Invalid endUserMessage');
        }

        const nl = endUserMessage['nl'];
        if (typeof nl !== 'string') {
            throw new Error('Invalid endUserMessage nl');
        }
    }
}
