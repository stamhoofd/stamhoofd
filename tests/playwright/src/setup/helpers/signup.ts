import { Page } from "@playwright/test";
import { WorkerContext } from "./setupWorker";

export type AccountDetails = {
    email: string;
    password: string;
    organization: string;
    firstName: string;
    lastName: string;
    organizationType: "Youth";
    umbrellaOrganization?: "Other";
    address: {
        street: string;
        postalCode: string;
        city: string;
    };
};

export async function signup({
    account: {
        email,
        password,
        organization,
        firstName,
        lastName,
        organizationType,
        umbrellaOrganization,
        address,
    },
    page,
    workerContext,
}: {
    account: AccountDetails;
    page: Page;
    workerContext: WorkerContext;
}) {
    await page.goto(workerContext.urls.dashboard);

    // click signup
    await page.getByTestId("signup-link").click();

    // fill in first signup screen
    await page.getByTestId("organization-name-input").click();
    await page.getByTestId("organization-name-input").fill(organization);
    await page
        .getByTestId("organization-type-select")
        .selectOption(organizationType);

    if (umbrellaOrganization !== undefined) {
        await page
            .getByTestId("organization-umbrella-select")
            .selectOption(umbrellaOrganization);
    }

    await page.getByTestId("street-address-input").click();
    await page.getByTestId("street-address-input").fill(address.street);
    await page.getByTestId("postal-code-input").click();
    await page.getByTestId("postal-code-input").fill(address.postalCode);
    await page.getByTestId("city-input").click();
    await page.getByTestId("city-input").fill(address.city);
    await page.getByTestId("acquisition-recommended-checkbox").click();

    // next
    await page.getByTestId("signup-next-button").click();

    // fill in second signup screen
    await page.getByTestId("email-input").click();
    await page.getByTestId("email-input").fill(email);
    await page.getByTestId("first-name-input").click();
    await page.getByTestId("first-name-input").fill(firstName);
    await page.getByTestId("last-name-input").click();
    await page.getByTestId("last-name-input").fill(lastName);
    await page.getByTestId("password-input").click();
    await page.getByTestId("password-input").fill(password);
    await page.getByTestId("password-repeat-input").click();
    await page.getByTestId("password-repeat-input").fill(password);
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
}
