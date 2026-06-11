import { Request } from '@simonbackx/simple-endpoints';
import { PayconiqAccount, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory representation of a Payconiq payment.
 * Only the fields the backend (PayconiqPayment) actually reads are kept.
 */
export type PayconiqMockPayment = {
    payconiqId: string;
    /** The internal Stamhoofd payment id (parsed from the callbackUrl), used to drive the exchange */
    internalPaymentId: string | null;
    /** The url Payconiq redirects back to after an app-to-app payment */
    returnUrl: string | null;
    /** Payconiq status string (see PayconiqPayment.getResponseStatus) */
    status: 'PENDING' | 'IDENTIFIED' | 'AUTHORIZED' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
    /** Amount in euro (2 decimals), as sent to Payconiq */
    amount: number;
};

/**
 * Mocks the Payconiq API (https://api.ext.payconiq.com) for in-process Playwright/integration tests.
 *
 * Unlike StripeMocker/MollieMocker this stays static, because resetNock() re-installs
 * PayconiqMocker.setup() after every nock.cleanAll(): Payconiq is mocked globally for tests.
 *
 * Usage:
 *   PayconiqMocker.setup();          // (re)install the nock interceptors
 *   PayconiqMocker.reset();          // clear tracked payments (between tests)
 *   ... drive a checkout in the UI (provider = Payconiq) ...
 *   await PayconiqMocker.succeedPayment(); // mark the last payment paid + run the exchange
 */
export class PayconiqMocker {
    static payments: PayconiqMockPayment[] = [];

    static infect() {
        if (STAMHOOFD.environment !== 'test') {
            throw new Error('PayconiqMocker can only be used in test environment');
        }

        TestUtils.addBeforeAll(async () => {
            this.setup();
        });

        TestUtils.addAfterEach(() => {
            this.reset();
        });
    }

    static generateTestAccount() {
        // Todo: store the api key somewhere so we can validate it in the API calls
        return PayconiqAccount.create({
            id: uuidv4(),
            apiKey: 'testKey',
            merchantId: 'test',
            profileId: 'test',
            name: 'test',
            iban: 'BE56587127952688', // = random IBAN
            callbackUrl: 'https://www.example.com',
        });
    }

    static setup() {
        const handlePost = (body: any) => {
            const decoded = this.#decodeBody(body);
            const payconiqId = uuidv4();

            // The internal payment id is part of the callbackUrl: /payments/<id>?exchange=true
            let internalPaymentId: string | null = null;
            if (typeof decoded.callbackUrl === 'string') {
                const match = decoded.callbackUrl.match(/\/payments\/([^?/]+)/);
                if (match) {
                    internalPaymentId = decodeURIComponent(match[1]);
                }
            }

            this.payments.push({
                payconiqId,
                internalPaymentId,
                returnUrl: typeof decoded.returnUrl === 'string' ? decoded.returnUrl : null,
                status: 'PENDING',
                amount: typeof decoded.amount === 'number' ? decoded.amount : 0,
            });

            // The checkout href is opened by the frontend (app-to-app / QR). Tests intercept it.
            const checkout = 'https://payconiq-checkout.test/' + payconiqId;
            return [200, {
                paymentId: payconiqId,
                debtor: {
                    name: 'Test User',
                    iban: 'BE41878878996410', // random iban
                },
                _links: {
                    checkout: { href: checkout },
                    qrcode: { href: checkout },
                },
            }];
        };

        const handleGet = (uri: string) => {
            const payconiqId = uri.split('/').pop()!.split('?')[0];
            const payment = this.payments.find(p => p.payconiqId === payconiqId);
            if (!payment) {
                return [404, { message: 'Payment not found' }];
            }
            return [200, {
                paymentId: payment.payconiqId,
                status: payment.status,
                amount: payment.amount,
                debtor: {
                    name: 'Test User',
                    iban: 'BE41878878996410',
                },
            }];
        };

        // In test mode the backend talks to the Wero/Bancontact host (api.ext.payconiq.com is
        // the legacy host); mock both so the status poll works regardless.
        for (const host of ['https://api.ext.payconiq.com', 'https://merchant.api.preprod.bancontact.net']) {
            nock(host).persist().post('/v3/payments').reply((_uri, body) => handlePost(body));
            nock(host).persist().get(/\/v3\/payments\/.+/).reply(uri => handleGet(uri) as [number, unknown]);
            nock(host).persist().delete(/\/v3\/payments\/.+/).reply(() => [204, undefined]);
        }
    }

    static reset() {
        this.payments = [];
    }

    static getLastPayment(): PayconiqMockPayment {
        return this.payments[this.payments.length - 1];
    }

    /**
     * Mark a payment as succeeded and trigger the payment exchange (the equivalent of the Payconiq
     * callback), so the backend processes the status change (balance items, tickets, ...).
     */
    static async succeedPayment(payment: PayconiqMockPayment = this.getLastPayment()) {
        payment.status = 'SUCCEEDED';
        await this.#exchange(payment);
    }

    static async failPayment(payment: PayconiqMockPayment = this.getLastPayment()) {
        payment.status = 'FAILED';
        await this.#exchange(payment);
    }

    static async #exchange(payment: PayconiqMockPayment) {
        if (!payment.internalPaymentId) {
            return;
        }

        // For some reason the tests go crazy when we try to import this at the top even when we preload the environment it
        // despearately imports the file before loading the STAMHOOFD environment...
        const { ExchangePaymentEndpoint } = await import('../../src/endpoints/organization/shared/ExchangePaymentEndpoint.js');
        const { testServer } = await import('./TestServer.js');

        const endpoint = new ExchangePaymentEndpoint();
        const request = Request.buildJson('POST', `/v${Version}/payments/${encodeURIComponent(payment.internalPaymentId)}?exchange=true`, undefined, undefined);
        await testServer.test(endpoint, request);
    }

    static #decodeBody(body: unknown): Record<string, any> {
        if (!body) {
            return {};
        }
        if (typeof body === 'string') {
            try {
                return JSON.parse(body);
            } catch {
                return {};
            }
        }
        return body as Record<string, any>;
    }
}
