import { PayconiqAccount } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';

export class PayconiqMocker {
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
        nock('https://api.ext.payconiq.com')
            .persist()
            .post('/v3/payments')
            .reply((uri, body) => {
                // todo: do something smarter with the body

                return [200, {
                    paymentId: uuidv4(),
                    _links: {
                        checkout: {
                            href: 'https://payconiq.com/pay/2/5bdb1685b93d1c000bde96f2?token=530ea8a4ec8ded7d87620c8637354022cd965b143f257f8f8cb118e7f4a22d8f&returnUrl=https%3A%2F%2Fummy.webshop%2Fcheckout%2Fsuccess',
                        },
                        qrcode: {
                            href: 'https://payconiq.com/pay/2/5bdb1685b93d1c000bde96f2?token=530ea8a4ec8ded7d87620c8637354022cd965b143f257f8f8cb118e7f4a22d8f&returnUrl=https%3A%2F%2Fummy.webshop%2Fcheckout%2Fsuccess',
                        },
                    },
                }];
            });

        nock('https://merchant.api.preprod.bancontact.net')
            .persist()
            .post('/v3/payments')
            .reply((uri, body) => {
                // todo: do something smarter with the body

                return [200, {
                    paymentId: uuidv4(),
                    _links: {
                        checkout: {
                            href: 'https://payconiq.com/pay/2/5bdb1685b93d1c000bde96f2?token=530ea8a4ec8ded7d87620c8637354022cd965b143f257f8f8cb118e7f4a22d8f&returnUrl=https%3A%2F%2Fummy.webshop%2Fcheckout%2Fsuccess',
                        },
                        qrcode: {
                            href: 'https://payconiq.com/pay/2/5bdb1685b93d1c000bde96f2?token=530ea8a4ec8ded7d87620c8637354022cd965b143f257f8f8cb118e7f4a22d8f&returnUrl=https%3A%2F%2Fummy.webshop%2Fcheckout%2Fsuccess',
                        },
                    },
                }];
            });
    }

    static reset() {
        // todo: clean up any state if needed
    }
}
