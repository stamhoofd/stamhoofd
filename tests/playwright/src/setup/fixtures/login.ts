import { createWorkerFixture } from "../helpers/createWorkerFixture";
import { WorkerContext } from "../helpers/setupWorker";
import { AccountDetails, signup } from "../helpers/signup";

export const test = createWorkerFixture<{ account: AccountDetails }>(
    async ({browser}, workerContext: WorkerContext) => {
        const page = await browser.newPage();

        const account: AccountDetails = {
            email: "test@test.be",
            password: "Stamhoofd",
            organization: "vereniging",
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

        await page.close();

        return {
            account,
        };
    },
);
