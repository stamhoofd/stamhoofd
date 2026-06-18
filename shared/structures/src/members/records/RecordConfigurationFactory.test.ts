import { describe, expect, test } from 'vitest';
import { RecordConfigurationFactory } from './RecordConfigurationFactory.js';

describe('RecordConfigurationFactory.createPlatformDefault', () => {
    test('enables the birth date for everyone', () => {
        const config = RecordConfigurationFactory.createPlatformDefault();
        expect(config.birthDay).not.toBeNull();
        expect(config.birthDay!.enabledWhen).toBeNull();
    });

    test('asks the email address based on age', () => {
        const config = RecordConfigurationFactory.createPlatformDefault();
        expect(config.emailAddress).not.toBeNull();
        expect(config.emailAddress!.enabledWhen).not.toBeNull();
    });

    test('asks the parents based on age', () => {
        const config = RecordConfigurationFactory.createPlatformDefault();
        expect(config.parents).not.toBeNull();
        expect(config.parents!.enabledWhen).not.toBeNull();
    });

    test('does not add record categories', () => {
        const config = RecordConfigurationFactory.createPlatformDefault();
        expect(config.recordCategories).toHaveLength(0);
    });
});
