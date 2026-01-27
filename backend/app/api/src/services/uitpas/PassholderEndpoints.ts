import { SimpleError } from '@simonbackx/simple-errors';
import { handleUitpasResponse } from './handleUitpasResponse.js';

export type GetPassResponse = {
    passholderId: string;
    uitpasNumber: string;
    firstName: string;
    points: number;
    postalCode: string;
    socialTariff: {
        status: 'ACTIVE' | 'EXPIRED' | 'NONE';
        endDate?: string;
    };
    messages?: {
        level: 'INFO' | 'WARN' | 'ERROR';
        text: string;
    }[];
};

export class PassholderEndpoints {
    private readonly baseUrl = getBaseUrl();

    constructor(private readonly access_token: string) {}

    /**
     * https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/get-a-pass
     * @param uitpasNumber
     */
    async getPassByUitpasNumber(uitpasNumber: string): Promise<GetPassResponse> {
        let response: Response;

        try {
            response = await fetch(`${this.baseUrl}/passes/${uitpasNumber}`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(10000),
            });
        }
        catch (error) {
            if (isTimeout(error)) {
                throw new SimpleError({
                    statusCode: 408,
                    code: 'uitpas_timeout',
                    message: `Timeout when retrieving pass by UiTPAS number`,
                    human: $t(
                        `We konden UiTPAS niet bereiken om jouw UiTPAS-nummer te valideren. Probeer het later opnieuw.`,
                    ),
                });
            }

            throw new SimpleError({
                code: 'uitpas_unreachable_retrieving_pass_by_uitpas_number',
                message: `Network issue when retrieving pass by UiTPAS number`,
                human: $t(
                    `We konden UiTPAS niet bereiken om jouw UiTPAS-nummer te valideren. Probeer het later opnieuw.`,
                ),
            });
        }

        const json = await handleUitpasResponse(response);
        return jsonToGetPassResponse(json);
    }

    private getHeaders(): Headers {
        const headers = new Headers();
        headers.append('Authorization', 'Bearer ' + this.access_token);
        return headers;
    }
}

function isTimeout(error: any): boolean {
    return error['name'] === 'TimeoutError';
}

function jsonToGetPassResponse(json: unknown): GetPassResponse {
    assertValidGetPassResponse(json);
    return {
        passholderId: json.passholderId,
        uitpasNumber: json.uitpasNumber,
        firstName: json.firstName,
        points: json.points,
        postalCode: json.postalCode,
        socialTariff: {
            status: json.socialTariff.status,
            endDate: json.socialTariff.endDate,
        },
        messages: json.messages?.map((m) => {
            return {
                level: m.level,
                text: m.text,
            };
        }),
    };
}

function assertValidGetPassResponse(json: unknown): asserts json is GetPassResponse {
    try {
        if (typeof json !== 'object') {
            throw new Error('Not an object');
        }

        if (json === null) {
            throw new Error('Null');
        }

        const stringProperties = ['passholderId', 'uitpasNumber', 'firstName', 'postalCode'];

        stringProperties.forEach((key) => {
            if (typeof json[key] !== 'string') {
                throw new Error(`Invalid ${key}`);
            }
        });

        const points = json['points'];
        if (typeof points !== 'number') {
            throw new Error('Invalid points');
        }

        const socialTariff = json['socialTariff'];
        if (typeof socialTariff !== 'object' || socialTariff === null) {
            throw new Error('Invalid socialTariff');
        }

        const status = socialTariff['status'];
        if (!(status === 'ACTIVE' || status === 'EXPIRED' || status === 'NONE')) {
            throw new Error('Invalid socialTariff status');
        }

        const endDate = socialTariff['endDate'];
        if (endDate !== undefined && typeof endDate !== 'string') {
            throw new Error('Invalid socialTariff endDate');
        }

        const messages = json['messages'];
        if (messages !== undefined) {
            if (!Array.isArray(messages)) {
                throw new Error('Invalid messages');
            }

            messages.forEach((message) => {
                if (typeof message !== 'object' || message === null) {
                    throw new Error('Invalid message');
                }

                const level = message['level'];
                if (!(level === 'INFO' || level === 'WARN' || level === 'ERROR')) {
                    throw new Error('Invalid message level');
                }

                const text = message['text'];
                if (typeof text !== 'string') {
                    throw new Error('Invalid message text');
                }
            });
        }
    }
    catch (error) {
        console.error('Invalid response when retrieving pass by UiTPAS number:', json);
        throw new SimpleError({
            code: 'invalid_response_retrieving_pass_by_uitpas_number',
            message: `Invalid response when retrieving pass by UiTPAS  number: ${error.message}`,
            human: $t(`4c6482ff-e6d9-4ea1-b11d-e12d697b4b7b`),
        });
    }
}

function getBaseUrl(): string {
    const baseUrl = STAMHOOFD.UITPAS_API_URL;

    if (baseUrl === undefined) {
        throw new Error('Missing environment variable UITPAS_API_URL');
    }

    return baseUrl;
}
