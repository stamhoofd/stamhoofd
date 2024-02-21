import { Request } from "@simonbackx/simple-endpoints";
import { StripeAccount } from "@stamhoofd/models";
import nock from "nock";
import qs from 'qs';
import { v4 as uuidv4 } from "uuid";

import { StripeWebookEndpoint } from "../../src/endpoints/stripe/StripeWebhookEndpoint";
import { StripeHelper } from "../../src/helpers/StripeHelper";

export class StripeMocker {
    paymentIntents: {id: string}[] = []
    charges: {id: string}[] = [];
    #forceFailure = false;

    reset() {
        this.paymentIntents = [];
        this.charges = [];
        this.#forceFailure = false;
    }

    forceFailure() {
        this.#forceFailure = true;
    }

    start() {
        nock('https://api.stripe.com')
            .persist()
            .get(/v1\/.*/)
            .reply((uri, body) => {
                const [match, resource, id] = uri.match(/\/?v1\/(\w+)(?:\/?(\w+)){0,2}/) || [null];

                if (!match) {
                    return [500];
                }

                if (resource === 'payment_intents') {
                    return this.#getPaymentIntent(id);
                }

                if (resource === 'charges') {
                    return this.#getCharge(id);
                }

                return [500];
            });

        nock('https://api.stripe.com')
            .persist()
            .post(/v1\/.*/)
            .reply((uri, body: string) => {
                const [match, resource, id] = uri.match(/\/?v1\/(\w+)(?:\/?(\w+)){0,2}/) || [null];

                if (!match) {
                    return [500];
                }

                if (this.#forceFailure ) {
                    return [400];
                }

                if (resource === 'payment_methods') {
                    // Ignore: this is just creating a saved payment method for Bancontact/iDEAL
                    return [200, {
                        object: 'payment_method',
                        id: this.createId('pm')
                    }]
                }

                if (resource === 'payment_intents') {
                    return this.#createPaymentIntent();
                }

                return [500];
            });


    }

    clear() {
        this.paymentIntents = [];
        this.charges = [];
    }

    createId(prefix: string) {
        return prefix + '_' + uuidv4().replaceAll('-', '');
    }

    #getPaymentIntent(id: string) {
        const intent = this.paymentIntents.find(i => i.id === id);
        if (!intent) {
            return [404]
        }
        return [200, intent];
    }

    #getCharge(id: string) {
        const intent = this.charges.find(i => i.id === id);
        if (!intent) {
            return [404]
        }
        return [200, intent];
    }

    #createPaymentIntent() {
        const intent = {
            object: 'payment_intent',
            id: this.createId('pi'),
            status: 'requires_action',
            next_action: {
                redirect_to_url: {
                    url: 'https://paymenturl'
                }
            }
        };
        this.paymentIntents.push(intent);
        return [200, intent];
    }

    getLastIntent() {
        return this.paymentIntents[this.paymentIntents.length - 1]
    }

    async succeedPayment(intent) {
        const charge = {
            id: this.createId('ch'),
            payment_method_details: {
                bancontact: {
                    iban_last4: 1234,
                    verified_name: 'John Doe'
                }
            }
        };

        this.charges.push(charge);

        intent.status = 'succeeded';
        intent.latest_charge = charge.id;

        await this.#sendWebhook({
            type: 'payment_intent.succeeded',
            data: {
                object: intent
            }
        })
    }

    async failPayment(intent) {
        intent.status = 'canceled';

        await this.#sendWebhook({
            type: 'payment_intent.payment_failed',
            data: {
                object: intent
            }
        })
    }

    async #sendWebhook(payload: {[key: string]: unknown}) {
        payload.id = this.createId('wh');

        const stripe = StripeHelper.getInstance()
        const endpoint = new StripeWebookEndpoint()
        
        const r = Request.buildJson("POST", `/stripe/webhooks`, undefined, payload);
        r.headers['stripe-signature'] = stripe.webhooks.generateTestHeaderString({
            payload: JSON.stringify(payload),
            secret: STAMHOOFD.STRIPE_ENDPOINT_SECRET
        })
        await endpoint.test(r);
    }

    decodeBody(body: string) {
        return qs.parse(body, {
            allowPrototypes: true,
            decoder(value: unknown) {
                // Convert numbers to numbers and bools to bools
                if (typeof value === 'string' && /^(\d+|\d*\.\d+)$/.test(value)) {
                    return parseFloat(value);
                }

                const keywords = {
                    true: true,
                    false: false,
                    null: null
                };
                if (typeof value === 'string' && value in keywords) {
                    return keywords[value];
                }

                if (typeof value === 'string') {
                    return decodeURIComponent(value);
                }

                return value;
            }
        });
    }

    async createStripeAccount(organizationId: string): Promise<StripeAccount> {
        const account = new StripeAccount()
        account.organizationId = organizationId
        account.accountId = this.createId('acct');
        account.setMetaFromStripeAccount(defaultBlobData)
        await account.save();
        return account;
    }

    stop() {
        nock.cleanAll()
    }
}

const defaultBlobData = {
    "business_profile": {
        "annual_revenue": null,
        "estimated_worker_count": null,
        "mcc": "8641",
        "name": "Demo vereniging",
        "support_address": null,
        "support_email": null,
        "support_phone": null,
        "support_url": null,
        "url": "www.stamhoofd.be"
    },
    "capabilities": {
        "bancontact_payments": "active",
        "card_payments": "active",
        "ideal_payments": "active",
        "transfers": "active"
    },
    "charges_enabled": true,
    "country": "BE",
    "created": 0,
    "default_currency": "eur",
    "details_submitted": true,
    "email": "tests@stamhoofd.be",
    "external_accounts": {
    "data": [
        {
            "account": "acct_test",
            "account_holder_name": null,
            "account_holder_type": null,
            "account_type": null,
            "available_payout_methods": [
                "standard"
            ],
            "bank_name": "KBC BANK NV",
            "country": "BE",
            "currency": "eur",
            "default_for_currency": true,
            "fingerprint": "xxxxxxxxxxxx",
            "future_requirements": {
                "currently_due": [],
                "errors": [],
                "past_due": [],
                "pending_verification": []
            },
            "id": "ba_xxxxxxxxxxx",
            "last4": "1111",
            "metadata": {},
            "object": "bank_account",
            "requirements": {
                "currently_due": [],
                "errors": [],
                "past_due": [],
                "pending_verification": []
            },
            "routing_number": "KREDBEBB",
            "status": "new"
        }
    ],
    "has_more": false,
    "object": "list",
    "total_count": 1,
    "url": "/v1/accounts/acct_test/external_accounts"
    },
    "future_requirements": {
        "alternatives": [],
        "current_deadline": null,
        "currently_due": [],
        "disabled_reason": null,
        "errors": [],
        "eventually_due": [],
        "past_due": [],
        "pending_verification": []
    },
    "id": "acct_text",
    "login_links": {
        "data": [],
        "has_more": false,
        "object": "list",
        "total_count": 0,
        "url": "/v1/accounts/acct_test/login_links"
    },
    "metadata": {},
    "object": "account",
    "payouts_enabled": true,
    "requirements": {
        "alternatives": [],
        "current_deadline": null,
        "currently_due": [],
        "disabled_reason": null,
        "errors": [],
        "eventually_due": [],
        "past_due": [],
        "pending_verification": []
    },
    "settings": {
    "bacs_debit_payments": {
        "display_name": null,
        "service_user_number": null
    },
    "branding": {
        "icon": "file_test",
        "logo": null,
        "primary_color": "#000000",
        "secondary_color": "#000000"
    },
    "card_issuing": {
        "tos_acceptance": {
            "date": null,
            "ip": null
        }
    },
    "card_payments": {
        "decline_on": {
            "avs_failure": false,
            "cvc_failure": false
        },
        "statement_descriptor_prefix": null,
        "statement_descriptor_prefix_kana": null,
        "statement_descriptor_prefix_kanji": null
    },
    "dashboard": {
        "display_name": "Stamhoofd",
        "timezone": "Etc/UTC"
    },
    "invoices": {
        "default_account_tax_ids": null
    },
    "payments": {
        "statement_descriptor": "WWW.STAMHOOFD.BE",
        "statement_descriptor_kana": null,
        "statement_descriptor_kanji": null
    },
    "payouts": {
        "debit_negative_balances": true,
        "schedule": {
        "delay_days": 7,
        "interval": "weekly",
        "weekly_anchor": "monday"
        },
        "statement_descriptor": null
    },
    "sepa_debit_payments": {}
    },
    "tos_acceptance": {
     "date": 0
    },
    "type": "express"
};