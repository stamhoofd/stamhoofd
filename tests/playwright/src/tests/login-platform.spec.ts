// test should always be imported first
import { test } from '../test-fixtures/base';

// other imports
import {
    Organization,
    OrganizationFactory,
    Token,
    User,
    UserFactory,
} from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers';

test.describe('Login', () => {
    let organization: Organization;
    let user: User;

    const organizationName = 'Test Organization';
    const email = 'john.doe@gmail.com';
    const password = 'testAbc123456';

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
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
        await WorkerData.resetDatabase();
    });

    test('happy path', async ({ page, pages }) => {
        await pages.dashboard.goto();

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

        // wait for the organization search input
        await page.getByTestId('organization-search-input').waitFor();
    });
});
