import { test } from "../setup/fixtures/workerFixture";
import { AccountDetails, signup } from "../setup/helpers/signup";

test("Login - happy flow", async ({ page, workerContext, TestUtils }) => {
    TestUtils.setPermanentEnvironment("userMode", "organization");

    // todo: configure in DataBase instead
    // signup
    const organizationName = "vereniging";
    const account: AccountDetails = {
        email: "test@test.be",
        password: "Stamhoofd",
        organization: organizationName,
        firstName: "voornaam",
        lastName: "achternaam",
        organizationType: "Youth",
        umbrellaOrganization: "Other",
        address: {
            street: "straat 1",
            postalCode: "9230",
            city: "Wetteren",
        },
    };

    await signup({
        account,
        page,
        workerContext,
    });

    // todo: proper assert
    // assert
    await page
        .getByRole("button", { name: organizationName })
        .waitFor();
});
