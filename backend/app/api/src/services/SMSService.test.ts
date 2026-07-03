import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { initSMSApi } from '../../tests/init/index.js';
import { SMSService } from './SMSService.js';

describe('SMSService', () => {
    describe('configuration', () => {
        test('is configured when GATEWAYAPI_TOKEN is set', () => {
            // The test environment configures GATEWAYAPI_TOKEN by default
            expect(SMSService.isConfigured).toBe(true);
        });

        test('is not configured when GATEWAYAPI_TOKEN is missing', () => {
            TestUtils.setEnvironment('GATEWAYAPI_TOKEN', undefined);
            expect(SMSService.isConfigured).toBe(false);
        });
    });

    describe('phone number formatting', () => {
        test('converts to E.164 and msisdn', () => {
            expect(SMSService.toE164('+32 470 12 34 56')).toBe('+32470123456');
            expect(SMSService.toMsisdn('+32 470 12 34 56')).toBe(32470123456);
        });

        test('throws for invalid phone numbers', () => {
            expect(() => SMSService.toE164('not-a-number')).toThrow(STExpect.errorWithCode('invalid_phone'));
        });
    });

    describe('sending', () => {
        test('sends via GatewayAPI', async () => {
            const mocker = initSMSApi();

            await SMSService.send({ to: '+32 470 12 34 56', message: 'Your code is 1234' });

            expect(mocker.sentMessages.length).toBe(1);
            expect(mocker.lastMessage!.recipient).toBe(32470123456);
            expect(mocker.lastMessage!.message).toBe('Your code is 1234');
        });

        test('throws sms_not_configured when GATEWAYAPI_TOKEN is missing', async () => {
            TestUtils.setEnvironment('GATEWAYAPI_TOKEN', undefined);

            await expect(SMSService.send({ to: '+32470123456', message: 'hi' }))
                .rejects
                .toThrow(STExpect.errorWithCode('sms_not_configured'));
        });
    });
});
