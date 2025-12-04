import { column } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueryableModel } from '@stamhoofd/sql';
import { PayconiqAccount, PaymentStatus, Version } from '@stamhoofd/structures';
import { IncomingMessage } from 'http';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';

import { Organization, Payment } from './index.js';
import { Formatter } from '@stamhoofd/utility';

export class PayconiqPayment extends QueryableModel {
    static table = 'payconiq_payments';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    paymentId: string;

    @column({ type: 'string' })
    payconiqId: string;

    getResponseStatus(response: any) {
        if (response.status) {
            switch (response.status) {
                case 'AUTHORIZED': return PaymentStatus.Pending;
                case 'PENDING': return PaymentStatus.Created;

                case 'IDENTIFIED': return PaymentStatus.Pending; // Code has been scanned!

                case 'AUTHORIZATION_FAILED': return PaymentStatus.Failed;
                case 'EXPIRED': return PaymentStatus.Failed;
                case 'FAILED': return PaymentStatus.Failed;
                case 'CANCELLED': return PaymentStatus.Failed;

                case 'SUCCEEDED': return PaymentStatus.Succeeded;
            }
            return PaymentStatus.Pending; // default to pending
        }

        throw new SimpleError({
            code: '',
            message: 'Status missing in response',
        });
    }

    async getStatus(organization: Organization, payment: Payment): Promise<PaymentStatus> {
        const apiKey = organization.privateMeta.payconiqApiKey;
        if (!apiKey) {
            throw new SimpleError({
                code: '',
                message: 'Payconiq API key missing to check the status of the payment',
            });
        }

        const testMode = organization.privateMeta.useTestPayments ?? (STAMHOOFD.environment !== 'production');
        const response = await PayconiqPayment.request('GET', '/v3/payments/' + this.payconiqId, {}, apiKey, testMode);

        if (typeof response !== 'object' || response === null) {
            throw new SimpleError({
                code: '',
                message: 'Invalid Payconiq response',
            });
        }
        const status = this.getResponseStatus(response);

        // Check debtor
        if ('debtor' in response && typeof response.debtor === 'object' && response.debtor !== null) {
            try {
                const name = response.debtor.name;
                const iban = response.debtor.iban;

                if (typeof iban === 'string') {
                    payment.iban = Formatter.iban(iban);
                }

                if (typeof name === 'string') {
                    payment.ibanName = name.substring(0, 128);
                }
                await payment.save();
            }
            catch (e) {
                console.error('Failed to save iban in Payconiq payment');
                console.error(e);
            }
        }

        // Check and save amount
        if (typeof response.amount === 'number' && status === PaymentStatus.Succeeded) {
            const amount = response.amount * 100; // Convert from integer with 2 decimal places to 4 places
            if (amount < payment.price) {
                // We do NOT allow lower prices
                console.error('Manual price change detected by Payconiq user. Failing the payment');
                console.error('Expected: ' + payment.price + '; Received: ' + amount);
                return PaymentStatus.Failed;
            }
        }

        return status;
    }

    async cancel(organization: Organization): Promise<boolean> {
        const apiKey = organization.privateMeta.payconiqApiKey;
        if (!apiKey) {
            throw new SimpleError({
                code: '',
                message: 'Payconiq API key missing to check the status of the payment',
            });
        }

        // Throws on failure
        try {
            await PayconiqPayment.request('DELETE', '/v3/payments/' + this.payconiqId, {}, apiKey, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production');
            return true;
        }
        catch (e) {
            console.error('Failed to cancel Payconiq payment', this.id, this.payconiqId, this.payconiqId, e);
            return false;
        }
    }

    static async createTest(organization: Organization, payconiqAccount: PayconiqAccount): Promise<undefined | object> {
        const apiKey = payconiqAccount.apiKey;
        if (!apiKey) {
            return;
        }

        try {
            const response = await this.request('POST', '/v3/payments', {
                reference: 'test-' + (new Date().getTime()), // 36 chars, max length is 35...
                amount: 1,
                currency: 'EUR',
                callbackUrl: 'https://' + organization.getApiHost(),
                description: 'Key validation test',

            }, apiKey, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production');
            return response;
        }
        catch (e) {
            return;
        }
    }

    static async createPayment(payment: Payment, organization: Organization, description: string, returnUrl?: string, callbackUrl?: string): Promise<{ paymentUrl: string; paymentQRCode: string }> {
        const apiKey = organization.privateMeta.payconiqApiKey;
        if (!apiKey) {
            throw new SimpleError({
                code: '',
                message: $t('4a3b54dc-e945-4a15-8b31-b9b4bb483b2a'),
            });
        }

        const response = await this.request('POST', '/v3/payments', {
            reference: payment.id.replaceAll('-', ''), // 36 chars, max length is 35.... The actual id is also in the description
            amount: Math.round(payment.price / 100), // 4 decimals to 2 decimals
            currency: 'EUR',
            callbackUrl: callbackUrl ?? 'https://' + organization.getApiHost() + '/v' + Version + '/payments/' + encodeURIComponent(payment.id) + '?exchange=true',
            returnUrl,
            description: Formatter.sepaPaymentSlug(description).substring(0, 140), // Lmimit to 140 chars
        }, apiKey, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production');

        const payconiqPayment = new PayconiqPayment();
        payconiqPayment.paymentId = payment.id;
        payconiqPayment.payconiqId = response.paymentId;

        // Read link
        const paymentUrl = response._links.checkout.href as string;
        let paymentQRCode = response._links.qrcode.href as string;

        if (typeof paymentUrl !== 'string' || typeof paymentQRCode !== 'string') {
            console.error('Unsupported Payconiq response', response);
            throw new SimpleError({
                code: '',
                message: $t('4a3b54dc-e945-4a15-8b31-b9b4bb483b2a'),
            });
        }

        try {
            // Grow QR-code in size
            const u = new URL(paymentQRCode);
            u.searchParams.set('s', 'L');
            paymentQRCode = u.toString();
        }
        catch (e) {
            console.error('Found unreadable payment QR Code');
            console.error(e);
        }

        await payconiqPayment.save();

        return {
            paymentUrl,
            paymentQRCode,
        };
    }

    /**
     * Do a post request on the API.
     */
    private static request(method: string, path: string, data = {}, auth: string | null = null, testMode: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            const jsonData = JSON.stringify(data);

            // Payconiq switches to Wero on 2025-10-19
            const isWero = testMode || Date.now() > new Date('2025-10-19T02:00:00+02:00').getTime();
            let hostname = !testMode ? 'api.payconiq.com' : 'api.ext.payconiq.com';
            if (isWero) {
                hostname = !testMode ? 'merchant.api.bancontact.net' : 'merchant.api.preprod.bancontact.net';
            }
            const base = 'https://' + hostname;

            // Log all communication
            console.log(method + ' ' + base + path + '\n' + jsonData);
            console.log(jsonData);

            const headers = {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(jsonData),
            };

            if (auth) {
                headers['Authorization'] = 'Bearer ' + auth;
            }

            const req = https.request(
                {
                    hostname: hostname,
                    path: path,
                    method: method,
                    headers: headers,
                    timeout: 10000,
                },
                (response: IncomingMessage) => {
                    console.log(`statusCode: ${response.statusCode ?? '/'}`);
                    console.log(`HEADERS: ${JSON.stringify(response.headers)}`);

                    const chunks: any[] = [];

                    response.on('data', (chunk) => {
                        chunks.push(chunk);
                    });

                    response.on('end', () => {
                        try {
                            if (!response.statusCode) {
                                reject(new Error('Unexpected order of events'));
                                return;
                            }
                            const body = Buffer.concat(chunks).toString();
                            console.log(body);

                            if (response.statusCode == 204) {
                                resolve(undefined);
                                return;
                            }

                            let json: any;
                            try {
                                json = JSON.parse(body);
                            }
                            catch (error) {
                                console.error(error);

                                // invalid json
                                if (response.statusCode < 200 || response.statusCode >= 300) {
                                    if (body.length == 0) {
                                        console.error(response.statusCode);
                                        reject(new Error('Status ' + response.statusCode));
                                        return;
                                    }
                                    console.error(response.statusCode + ' ' + body);
                                    reject(new Error(body));
                                    return;
                                }
                                else {
                                    // something wrong: throw parse error
                                    reject(error);
                                    return;
                                }
                            }

                            if (response.statusCode < 200 || response.statusCode >= 300) {
                                console.error(body);
                                reject(new Error(response.statusCode + ' ' + response.statusMessage));
                                return;
                            }

                            resolve(json);
                        }
                        catch (error) {
                            console.error(error);
                            reject(error);
                        }
                    });
                },
            );

            // use its "timeout" event to abort the request
            req.on('timeout', () => {
                req.abort();
            });

            req.on('error', (error) => {
                console.error(error);
                reject(error);
            });

            req.write(jsonData);
            req.end();
        });
    }
}
