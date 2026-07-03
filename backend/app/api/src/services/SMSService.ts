import { SimpleError } from '@simonbackx/simple-errors';
import { Platform } from '@stamhoofd/models';
import { Country } from '@stamhoofd/types/Country';
import type { CountryCode } from 'libphonenumber-js';
import { parsePhoneNumber } from 'libphonenumber-js/max';

const GATEWAY_API_URL = 'https://messaging.gatewayapi.eu/mobile/single';

export type SMSMessage = {
    /**
     * Phone number, either in international format (e.g. +32 470 12 34 56) or national format (e.g. 0470 12 34 56).
     */
    to: string;
    message: string;
    /**
     * Default country used to parse national phone numbers (numbers without a country code).
     */
    defaultCountry?: Country;
};

export class SMSService {
    static get isConfigured(): boolean {
        return !!STAMHOOFD.GATEWAYAPI_TOKEN;
    }

    /**
     * Convert a phone number to E.164 format (e.g. +32 470 12 34 56 -> +32470123456).
     */
    static toE164(phone: string, defaultCountry: Country = Country.Belgium): string {
        try {
            const parsed = parsePhoneNumber(phone, defaultCountry as unknown as CountryCode);
            if (parsed && parsed.isValid()) {
                return parsed.number;
            }
        } catch (e) {
            // handled below
        }

        throw new SimpleError({
            code: 'invalid_phone',
            message: 'Invalid phone number for SMS: ' + phone,
            human: $t(`%ZbO`),
        });
    }

    /**
     * Convert a phone number to the msisdn format expected by GatewayAPI: the full international
     * number without a leading '+' or '00' (e.g. +32 470 12 34 56 -> 32470123456).
     */
    static toMsisdn(phone: string, defaultCountry: Country = Country.Belgium): number {
        return parseInt(this.toE164(phone, defaultCountry).substring(1), 10);
    }

    static async send(sms: SMSMessage): Promise<void> {
        const token = STAMHOOFD.GATEWAYAPI_TOKEN;
        if (!token) {
            throw new SimpleError({
                code: 'sms_not_configured',
                message: 'SMS gateway is not configured',
                human: $t(`%ZbC`),
            });
        }

        const msisdn = this.toMsisdn(sms.to, sms.defaultCountry ?? Country.Belgium);

        let response: Response;
        try {
            response = await fetch(GATEWAY_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': 'Token ' + token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sender: (await Platform.getShared()).config.name,
                    message: sms.message,
                    recipient: msisdn,
                    priority: 'urgent',
                    expiration: 'PT10M',
                }),
                signal: AbortSignal.timeout(10000),
            });
        } catch (error) {
            throw new SimpleError({
                code: 'sms_unreachable',
                message: 'Network issue when sending SMS: ' + (error instanceof Error ? error.message : String(error)),
                human: $t(`%Zb8`),
            });
        }

        if (!response.ok) {
            const body = await response.text();
            console.error('Failed to send SMS via GatewayAPI', response.status, body);
            throw new SimpleError({
                code: 'sms_failed',
                message: 'Failed to send SMS via GatewayAPI: ' + response.status + ' ' + body,
                human: $t(`%Zb8`),
            });
        }
    }
}
