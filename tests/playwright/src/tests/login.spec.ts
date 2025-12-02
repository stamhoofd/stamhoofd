// test should always be imported first
import { test } from "../setup/fixtures";

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
import { WorkerHelper } from "../setup/helpers/WorkerHelper";
import { Database } from "@simonbackx/simple-database";

// login
test.describe("userMode organization", () => {
    console.log("inside: login - userMode organization");
    let organization: Organization;
    let user: User;

    const organizationName = "Test Organization";
    const email = "john.doe@gmail.com";
    const password = "testAbc123456";

    test.beforeAll(async () => {
        console.log("inside: login - userMode organization - beforeAll start");
        TestUtils.setPermanentEnvironment("userMode", "organization");

        await WorkerHelper.clearDatabase();
        const db = await Database.select('SELECT DATABASE();');
        console.log('Creating organization', organizationName, 'on database', process.env.DB_DATABASE, db[0]);
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
        console.log(
            "inside: login - userMode organization - beforeAll finished",
        );
    });

    test.afterAll(async () => {
        await WorkerHelper.clearDatabase();
    });

    test("happy path", async ({ page, dashboard }) => {
        console.log("inside: login - test userMode organization - start");
        await dashboard.goto();

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
        console.log("inside: login - test userMode organization - done");
    });

    test("happy path duplicate", async ({ page, dashboard }) => {
        console.log("inside: login - test userMode organization - start");
        await dashboard.goto();

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
        console.log("inside: login - test userMode organization - done");
    });

    test("happy path duplicate 2", async ({ page, dashboard }) => {
        console.log("inside: login - test userMode organization - start");
        await dashboard.goto();

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
        console.log("inside: login - test userMode organization - done");
    });
});

test.describe("userMode platform", () => {
    console.log("inside: userMode platform");
    let organization: Organization;
    let user: User;

    const organizationName = "Test Organization";
    const email = "john.doe@gmail.com";
    const password = "testAbc123456";

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment("userMode", "platform");

        await WorkerHelper.clearDatabase();

        const db = await Database.select('SELECT DATABASE();');
        console.log('Creating organization', organizationName, 'on database', process.env.DB_DATABASE, db[0]);
        organization = await new OrganizationFactory({
            name: organizationName,
        }).create();

        user = await new UserFactory({
            firstName: "John",
            lastName: "Doe",
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
        await WorkerHelper.clearDatabase();
    });

    test("happy path", async ({ page, dashboard }) => {
        await dashboard.goto();

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

        // wait for the organization search input
        await page.getByTestId("organization-search-input").waitFor();
    });

    test("happy path duplicate", async ({ page, dashboard }) => {
        await dashboard.goto();

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

        // wait for the organization search input
        await page.getByTestId("organization-search-input").waitFor();
    });
});
