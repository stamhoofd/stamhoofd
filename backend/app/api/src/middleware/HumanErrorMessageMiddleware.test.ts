import type { DecodedRequest } from '@stamhoofd/node-endpoints';
import { Endpoint, Request, Response } from '@stamhoofd/node-endpoints';
import { SimpleError, SimpleErrors } from '@stamhoofd/common-errors';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { testServer } from '../../tests/helpers/TestServer.js';

type Params = Record<string, never>;

/**
 * Throws the error a shared package would throw, so a request can assert what the middleware adds to it.
 */
class ThrowingEndpoint extends Endpoint<Params, undefined, undefined, string> {
    constructor(private readonly error: Error) {
        super();
    }

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET' || request.url !== '/throw') {
            return [false];
        }
        return [true, {}];
    }

    handle(_request: DecodedRequest<Params, undefined, undefined>): Promise<Response<string>> {
        throw this.error;
    }
}

function request(language = 'nl') {
    const r = Request.buildJson('GET', '/throw', 'localhost');
    r.headers['accept-language'] = language;
    return r;
}

describe('HumanErrorMessageMiddleware', () => {
    test('adds a human message to an unknown_filter error', async () => {
        const endpoint = new ThrowingEndpoint(
            new SimpleError({ code: 'unknown_filter', message: 'Unknown filter secret' }),
        );

        await expect(testServer.test(endpoint, request())).rejects.toThrow(
            expect.objectContaining({
                code: 'unknown_filter',
                human: 'Deze filter wordt niet ondersteund of er ging iets fout met deze filter',
            }),
        );
    });

    test('uses the language of the request', async () => {
        TestUtils.setEnvironment('locales', {
            [Country.Belgium]: [Language.Dutch, Language.French],
        });
        const endpoint = new ThrowingEndpoint(
            new SimpleError({ code: 'unknown_filter', message: 'Unknown filter secret' }),
        );

        await expect(testServer.test(endpoint, request('fr'))).rejects.toThrow(
            expect.objectContaining({
                code: 'unknown_filter',
                human: "Ce filtre n'est pas pris en charge ou une erreur s'est produite avec ce filtre",
            }),
        );
    });

    test('adds a human message to every unknown_filter error in a SimpleErrors', async () => {
        const endpoint = new ThrowingEndpoint(
            new SimpleErrors(
                new SimpleError({ code: 'unknown_filter', message: 'Unknown filter a' }),
                new SimpleError({ code: 'unknown_filter', message: 'Unknown filter b' }),
            ),
        );

        await expect(testServer.test(endpoint, request())).rejects.toThrow(
            expect.objectContaining({
                errors: [
                    expect.objectContaining({
                        code: 'unknown_filter',
                        human: 'Deze filter wordt niet ondersteund of er ging iets fout met deze filter',
                    }),
                    expect.objectContaining({
                        code: 'unknown_filter',
                        human: 'Deze filter wordt niet ondersteund of er ging iets fout met deze filter',
                    }),
                ],
            }),
        );
    });

    test.each([
        ['invalid_sort', 'Sorteren op dit veld is hier niet mogelijk'],
        ['sorter_join_overlap', 'Deze combinatie van sorteringen is niet mogelijk'],
        [
            'too_many_filter_values',
            'Te veel individueel geselecteerde waarden in jouw filter (het maximum is 1000). Probeer om alles in één keer te selecteren en daarna eventueel sommige rijen uit te sluiten, of gebruik een filter en selecteer alles.',
        ],
    ])('adds a human message to a %s error from @stamhoofd/node-sql', async (code, human) => {
        const endpoint = new ThrowingEndpoint(
            new SimpleError({ code, message: 'Internal message' }),
        );

        await expect(testServer.test(endpoint, request())).rejects.toThrow(
            expect.objectContaining({ code, human }),
        );
    });

    test('keeps an existing human message', async () => {
        const endpoint = new ThrowingEndpoint(
            new SimpleError({
                code: 'unknown_filter',
                message: 'Unknown filter secret',
                human: 'Eigen boodschap',
            }),
        );

        await expect(testServer.test(endpoint, request())).rejects.toThrow(
            expect.objectContaining({ code: 'unknown_filter', human: 'Eigen boodschap' }),
        );
    });

    test('leaves other errors untouched', async () => {
        const endpoint = new ThrowingEndpoint(
            new SimpleError({ code: 'not_found', message: 'Not found' }),
        );

        await expect(testServer.test(endpoint, request())).rejects.toThrow(
            expect.objectContaining({ code: 'not_found', human: undefined }),
        );
    });
});
