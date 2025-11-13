import { test } from "../setup/fixtures/login";

test("Login - happy flow", async ({ page, workerContext }) => {
    await page.goto(workerContext.urls.dashboard);

    await page
        .getByRole("button", { name: workerContext.account.organization })
        .waitFor();
});
