import nock from 'nock';
import { resetNock } from './resetNock.js';

export type SentSMS = {
    sender: string;
    message: string;
    recipient: number;
};

/**
 * Mocks the GatewayAPI SMS HTTP endpoint (https://messaging.gatewayapi.eu/rest/mtsms).
 *
 * This only intercepts the outgoing HTTP request, so all of the real SMSService code (payload
 * building, authentication, phone number normalization, error handling) runs during the test.
 */
export class SMSMocker {
    sentMessages: SentSMS[] = [];

    #forceFailure = false;

    reset() {
        this.sentMessages = [];
        this.#forceFailure = false;
    }

    /**
     * Make the next requests fail (server returns a 500).
     */
    forceFailure() {
        this.#forceFailure = true;
    }

    start() {
        nock('https://messaging.gatewayapi.eu')
            .persist()
            .post('/mobile/single')
            .reply((uri: string, requestBody: nock.Body) => {
                if (this.#forceFailure) {
                    return [500, { code: '0x0002', message: 'Forced failure' }];
                }

                const body = (typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody) as SentSMS;
                this.sentMessages.push({
                    sender: body.sender,
                    message: body.message,
                    recipient: body.recipient,
                });

                return [200, { ids: [this.sentMessages.length] }];
            });
    }

    stop() {
        this.reset();
        resetNock();
    }

    get lastMessage(): SentSMS | undefined {
        return this.sentMessages[this.sentMessages.length - 1];
    }
}
