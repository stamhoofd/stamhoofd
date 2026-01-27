import { sleep } from '@stamhoofd/utility';
import nock from 'nock';
import { resetNock } from './resetNock.js';

export type UitpasSocialTariff = {
    status: 'ACTIVE' | 'EXPIRED' | 'NONE';
    endDate?: string;
};

export type UitpasMessage = {
    level: 'INFO' | 'WARN' | 'ERROR';
    text: string;
};

export type UitpasApiResponse = {
    passholderId: string;
    uitpasNumber: string;
    firstName: string;
    points: number;
    postalCode: string;
    socialTariff: UitpasSocialTariff;
    messages?: UitpasMessage[];
};

export class UitpasMocker {
    /**
     * Real test data from uitpas api
     * https://docs.publiq.be/docs/uitpas/test-dataset
     */
    static readonly testData = new Map<string, UitpasApiResponse>([
        [
            '0900000095902',
            {
                passholderId: '6eb040fd-3c60-4049-8170-c61e4e52c009',
                uitpasNumber: '0900000095902',
                firstName: 'Valère',
                points: 8150,
                postalCode: '9000',
                socialTariff: { status: 'NONE' },
            },
        ],
        [
            '0900011354819',
            {
                passholderId: 'f24d31b4-ffab-4ded-98b6-3ab4a6308d4d',
                uitpasNumber: '0900011354819',
                firstName: 'Bernadette',
                points: 400,
                postalCode: '9340',
                socialTariff: {
                    status: 'ACTIVE',
                    endDate: '2026-04-30T21:59:59+00:00',
                },
            },
        ],
        [
            '0900000031618',
            {
                passholderId: 'd146126c-cc42-4b7f-8431-bb71a04131aa',
                uitpasNumber: '0900000031618',
                firstName: 'Vervallen Pas',
                points: 4,
                postalCode: '9000',
                socialTariff: {
                    status: 'EXPIRED',
                    endDate: '2025-01-28T22:59:59+00:00',
                },
                messages: [
                    {
                        level: 'WARN',
                        text: 'Je sociaal tarief is verlopen. Contacteer je UiTPAS balie',
                    },
                ],
            },
        ],
    ]);

    #forceFailure = false;
    #requestTimeoutInMs = 0;

    reset() {
        this.#forceFailure = false;
        this.#requestTimeoutInMs = 0;
    }

    forceFailure() {
        this.#forceFailure = true;
    }

    setRequestTimeout(ms: number) {
        this.#requestTimeoutInMs = ms;
    }

    start() {
        if (
            !STAMHOOFD.UITPAS_API_CLIENT_ID
            || !STAMHOOFD.UITPAS_API_CLIENT_SECRET?.startsWith('sk_test_')
        ) {
            throw new Error(
                'Invalid UITPAS_API_CLIENT_SECRET. Even in test mode it should start with sk_test_',
            );
        }

        // mock access-token
        nock('https://account-test.uitid.be')
            .persist()
            .post('/realms/uitid/protocol/openid-connect/token')
            .reply(200, {
                access_token: 'fake-access-token',
                token_type: 'Bearer',
                expires_in: 86400,
            });

        // mock get passes
        nock('https://api-test.uitpas.be')
            .persist()
            .get(/\/passes\/(\d+)/)
            .reply(async (uri: string) => {
                const matchArray = uri.match(/\/passes\/(\d+)/);

                if (this.#requestTimeoutInMs) {
                    await sleep(this.#requestTimeoutInMs);
                }

                if (!matchArray) {
                    return [500];
                }

                if (this.#forceFailure) {
                    return [503];
                }

                const uitpasNumber = matchArray[1];
                const result = UitpasMocker.testData.get(uitpasNumber);
                if (!result) {
                    return [
                        404,
                        {
                            type: 'https://api.publiq.be/probs/uitpas/pass-not-found',
                            title: 'Pass not found',
                            status: 404,
                            detail: '0900000031617',
                            endUserMessage: {
                                nl: 'Het UiTPAS-nummer dat je invulde konden we niet terugvinden. Kijk je het nummer even na?',
                            },
                        },
                    ];
                }

                return [200, result];
            });
    }

    stop() {
        this.reset();
        resetNock();
    }
}
