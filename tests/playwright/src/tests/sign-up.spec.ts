// test should always be imported first
import { test } from "../setup/fixtures";

import { expect } from "@playwright/test";
import { TestUtils } from "@stamhoofd/test-utils";
import { WorkerData } from "../setup/helpers/WorkerData";

// sign up
test("happy flow", async ({ page }) => {
    TestUtils.setPermanentEnvironment("userMode", "organization");

    await page.goto(WorkerData.urls.dashboard);

    // click signup
    await page.getByTestId("signup-link").click();

    // fill in first signup screen
    const organizationName = "vereniging";
    await page.getByTestId("organization-name-input").click();
    await page.getByTestId("organization-name-input").fill(organizationName);
    await page.getByTestId("organization-type-select").selectOption("Youth");
    await page
        .getByTestId("organization-umbrella-select")
        .selectOption("Other");

    await page.getByTestId("street-address-input").click();
    await page.getByTestId("street-address-input").fill("straat 1");
    await page.getByTestId("postal-code-input").click();
    await page.getByTestId("postal-code-input").fill("9230");
    await page.getByTestId("city-input").click();
    await page.getByTestId("city-input").fill("Wetteren");
    await page.getByTestId("acquisition-recommended-checkbox").click();

    // next
    await page.getByTestId("signup-next-button").click();

    // fill in second signup screen
    await page.getByTestId("email-input").click();
    await page.getByTestId("email-input").fill("test@test.be");
    await page.getByTestId("first-name-input").click();
    await page.getByTestId("first-name-input").fill("voornaam");
    await page.getByTestId("last-name-input").click();
    await page.getByTestId("last-name-input").fill("achternaam");
    await page.getByTestId("password-input").click();
    await page.getByTestId("password-input").fill("Stamhoofd");
    await page.getByTestId("password-repeat-input").click();
    await page.getByTestId("password-repeat-input").fill("Stamhoofd");
    await page.getByTestId("accept-privacy-input").click();
    await page.getByTestId("accept-terms-input").click();
    await page.getByTestId("accept-data-agreement-input").click();

    // signup
    await page.getByTestId("signup-account-button").click();

    // fill in code
    await page.locator('input[name="search-code_1"]').fill("1");
    await page.locator('input[name="search-code_2"]').fill("1");
    await page.locator('input[name="search-code_3"]').fill("1");
    await page.locator('input[name="search-code_4"]').fill("1");
    await page.locator('input[name="search-code_5"]').fill("1");
    await page.locator('input[name="search-code_6"]').fill("1");

    // wait for data-testid element to appear (h1 with name of organization)
    await page.getByTestId("organization-name").waitFor();

    // check if page contains name of organization
    await expect(page.getByTestId("organization-name")).toContainText(
        organizationName,
    );
});
