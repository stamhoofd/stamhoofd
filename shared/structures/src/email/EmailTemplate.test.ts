import { TestUtils } from '@stamhoofd/test-utils';
import { EmailTemplate, EmailTemplateType } from './EmailTemplate.js';

describe('EmailTemplate', () => {
    const judicialRecordTypes = Object.values(EmailTemplateType).filter(type => type.startsWith('JudicialRecord'));

    /**
     * The mirror of who may take the decision: a decision binds every organization the member is registered
     * with, so on a platform the wording is the platform's; in organization mode there is no other
     * organization bound by it.
     */
    describe('organization level judicial record templates', () => {
        test('are editable per organization in organization mode', () => {
            TestUtils.setEnvironment('userMode', 'organization');

            expect(judicialRecordTypes.length).toBeGreaterThan(0);

            for (const type of judicialRecordTypes) {
                expect(EmailTemplate.allowOrganizationLevelInGeneral(type)).toBe(true);
            }
        });

        test('are platform level only in platform mode', () => {
            TestUtils.setEnvironment('userMode', 'platform');

            for (const type of judicialRecordTypes) {
                expect(EmailTemplate.allowOrganizationLevelInGeneral(type)).toBe(false);
            }
        });

        /**
         * `allowPlatformLevel` is a separate question from `allowOrganizationLevelInGeneral`, and the default
         * wording has to keep existing in both modes - every send falls back to it.
         */
        test('stay available at platform level in both modes', () => {
            for (const userMode of ['platform', 'organization'] as const) {
                TestUtils.setEnvironment('userMode', userMode);

                for (const type of judicialRecordTypes) {
                    expect(EmailTemplate.allowPlatformLevel(type)).toBe(true);
                }
            }
        });
    });
});
