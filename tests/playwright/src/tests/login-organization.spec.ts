// test should always be imported first
import { test } from "../test-fixtures/base";

// other imports
import { expect } from "@playwright/test";
import {
    Organization,
    OrganizationFactory,
    Token,
    User,
    UserFactory,
} from "@stamhoofd/models";
import { PermissionLevel, Permissions } from "@stamhoofd/structures";
import { TestUtils } from "@stamhoofd/test-utils";
import { WorkerData } from "../helpers";

test.describe("Login", () => {
    let organization: Organization;
    let user: User;

    const organizationName = "Test Organization";
    const email = "john.doe@gmail.com";
    const password = "testAbc123456";

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment("userMode", "organization");
        organization = await new OrganizationFactory({
            name: organizationName,
        }).create();

        user = await new UserFactory({
            firstName: "John",
            lastName: "Doe",
            email,
            password,
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        await Token.createToken(user);
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test("happy path", async ({ page, pages }) => {
        await pages.dashboard.goto();

        // click search input and fill in organization name
        const searchInput = page.getByTestId("organization-search-input");
        await searchInput.click();
        await searchInput.fill(organizationName);

        // click organization
        await page
            .getByTestId("organization-button")
            .filter({ hasText: organizationName })
            .click();

        // fill in email
        const emailInput = page.getByTestId("email-input");
        await emailInput.click();
        await emailInput.fill(email);

        // fill in password
        const passwordInput = page.getByTestId("password-input");
        await passwordInput.click();
        await passwordInput.fill(password);

        // login
        await page.getByTestId("login-button").click();

        // wait for data-testid element to appear (h1 with name of organization)
        await page.getByTestId("organization-name").waitFor();

        // check if page contains name of organization
        await expect(page.getByTestId("organization-name")).toContainText(
            organizationName,
        );
    });
});
