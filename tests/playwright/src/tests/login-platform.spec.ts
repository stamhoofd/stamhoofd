// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type {
    Organization,
    User } from '@stamhoofd/models';
import {
    OrganizationFactory,
    Token,
    UserFactory,
} from '@stamhoofd/models';
import { expect } from '@playwright/test';
import { MFARecoveryCode, MFATOTP } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TwoFactorFlow } from '../flows/TwoFactorFlow.js';
import { WorkerData } from '../helpers/index.js';
import { setPlatformRequiresTwoFactor } from '../init/setPlatformRequiresTwoFactor.js';

test.describe('Login', () => {
    let organization: Organization;
    let user: User;

    const organizationName = 'Test Organization';
    const email = 'john.doe@gmail.com';
    const password = 'testAbc123456';

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        // Platform admins are only forced to enroll when the platform requires 2FA
        await setPlatformRequiresTwoFactor(true);

        organization = await new OrganizationFactory({
            name: organizationName,
        }).create();

        user = await new UserFactory({
            firstName: 'John',
            lastName: 'Doe',
            email,
            password,
            organization,
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        await Token.createToken(user);
    });

    test.afterAll(async () => {
        await setPlatformRequiresTwoFactor(false);
        await WorkerData.resetDatabase();
    });

    test('happy path', async ({ page, pages }) => {
        await pages.dashboard.goto();

        if (STAMHOOFD.singleOrganization) {
            throw new Error('Unexpected test environment leaked');
        }

        // fill in email
        const emailInput = page.getByTestId('email-input');
        await emailInput.click();
        await emailInput.fill(email);

        // fill in password
        const passwordInput = page.getByTestId('password-input');
        await passwordInput.click();
        await passwordInput.fill(password);

        // login
        await page.getByTestId('login-button').click();

        // Platform admins are required to have two-factor authentication: the password is
        // correct, but the login is only finished after enrolling a second factor. The
        // recovery codes are shown once, right before the user is signed in.
        await new TwoFactorFlow({ page }).completeForcedSetup();

        // wait for the organization search input
        await page.getByTestId('organization-search-input').waitFor();

        expect(await MFATOTP.getConfirmedForUser(user.id)).toHaveLength(1);
        expect(await MFARecoveryCode.getUnusedForUser(user.id)).toHaveLength(10);
    });
});
