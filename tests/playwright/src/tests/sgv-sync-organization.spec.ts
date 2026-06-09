// test should always be imported first
import { test } from "../test-fixtures/base.js";

import { expect } from "@playwright/test";
import { TestUtils } from "@stamhoofd/test-utils";
import { TestSGV, WorkerData } from "../helpers/index.js";

test.describe("SGV sync", () => {
    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    function membersSettingsUrl(organizationUri: string) {
        return `${WorkerData.urls.dashboard}/beheerders/${organizationUri}/instellingen/ledenadministratie`;
    }

    function localizedMembersSettingsUrl(organizationUri: string) {
        return `${WorkerData.urls.dashboard}/nl-BE/beheerders/${organizationUri}/instellingen/ledenadministratie`;
    }

    async function openMembersSettings(
        organizationUri: string,
        page: { goto: (url: string) => Promise<unknown> },
    ) {
        await page.goto(membersSettingsUrl(organizationUri));
    }

    function activePopup(page: import("@playwright/test").Page) {
        return page.locator("div.popup.focused").last();
    }

    test("SGV settings visibility happy path", async ({ page, pages }) => {
        TestUtils.setPermanentEnvironment("userMode", "organization");
        const context = await TestSGV.youthOrganization(
            "SGV Settings Visibility",
        );
        const user = await TestSGV.user(context.organization);

        await pages.dashboard.login({
            organizationUri: context.organization.uri,
            email: user.email,
            password: user.password,
        });
        await openMembersSettings(context.organization.uri, page);

        const action = page.getByText("Groepsadministratie synchroniseren", {
            exact: true,
        });
        await expect(action).toBeVisible();

        await action.click();
        await expect(
            activePopup(page).getByRole("heading", {
                name: "Groepsadministratie synchroniseren",
            }),
        ).toBeVisible();
        await expect(
            activePopup(page).getByText("Inloggen", { exact: true }),
        ).toBeVisible();
    });

    test("SGV OAuth login returns to members settings and reopens sync panel", async ({
        page,
        pages,
    }) => {
        TestUtils.setPermanentEnvironment("userMode", "organization");
        const context = await TestSGV.youthOrganization("SGV OAuth Login");
        const user = await TestSGV.user(context.organization);

        await pages.dashboard.login({
            organizationUri: context.organization.uri,
            email: user.email,
            password: user.password,
        });
        await openMembersSettings(context.organization.uri, page);

        await page.getByTestId("sgv-groepsadministratie-button").click();
        const popup = activePopup(page);
        await expect(
            popup.getByRole("heading", {
                name: "Groepsadministratie synchroniseren",
            }),
        ).toBeVisible();

        await popup.getByRole("button", { name: "Inloggen" }).click();

        await expect(page).toHaveURL(
            localizedMembersSettingsUrl(context.organization.uri),
        );
        await expect(
            activePopup(page).getByRole("heading", {
                name: "Start synchronisatie",
            }),
        ).toBeVisible();
        await expect(
            activePopup(page).getByText(
                "Je bent ingelogd in de groepsadministratie. Je kan nu beginnen met synchroniseren.",
            ),
        ).toBeVisible();
        await expect(
            activePopup(page).getByRole("button", { name: "Starten" }),
        ).toBeVisible();
    });
});
