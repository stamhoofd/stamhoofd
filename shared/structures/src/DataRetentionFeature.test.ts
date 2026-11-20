import { TestUtils } from '@stamhoofd/test-utils';

import { DATA_RETENTION_FEATURE_FLAG, isDataRetentionEnabled } from '#/index.ts';

const on = [DATA_RETENTION_FEATURE_FLAG];

describe('isDataRetentionEnabled', () => {
    test.each([
        { userMode: 'platform', platform: [], organization: on, expected: false },
        { userMode: 'platform', platform: on, organization: [], expected: true },
        { userMode: 'platform', platform: on, organization: null, expected: true },
        { userMode: 'organization', platform: [], organization: on, expected: false },
        { userMode: 'organization', platform: on, organization: [], expected: false },
        { userMode: 'organization', platform: on, organization: on, expected: true },
        { userMode: 'organization', platform: on, organization: null, expected: false },
    ] as const)(
        'userMode $userMode, platform $platform, organization $organization: $expected',
        ({ userMode, platform, organization, expected }) => {
            TestUtils.setEnvironment('userMode', userMode);
            expect(
                isDataRetentionEnabled({
                    platformFeatureFlags: [...platform],
                    organizationFeatureFlags: organization ? [...organization] : null,
                }),
            ).toBe(expected);
        },
    );
});
