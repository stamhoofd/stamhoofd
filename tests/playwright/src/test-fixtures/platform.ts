// First import base
import { test as base } from "./base";

// All other imports perferably later
import { Token, UserFactory } from "@stamhoofd/models";
import { Token as TokenStruct, Version } from "@stamhoofd/structures";
import { TestUtils } from "@stamhoofd/test-utils";
import fs from 'fs';
import path from "path";
import { WorkerData } from "../helpers";

/**
 * Base test fixture (unauthenticated)
 */
export const test = base.extend<
    {
    },
    {
        workerStorageState: string;
    }
>({
    // Use the same storage state for all tests in this worker.
    storageState: ({ workerStorageState }, use) => use(workerStorageState),
    // Authenticate once per worker with a worker-scoped fixture.
    workerStorageState: [
        async ({ browser }, use) => {

            // todo: this is authentication for userMode platform
            // maybe create new fixture for userMode organization?

            const fileName = path.resolve(
                test.info().project.outputDir,
                `.auth/${WorkerData.id}.json`,
            );

            if (fs.existsSync(fileName)) {
                // Reuse existing authentication state if any.
                await use(fileName);
                return;
            }

            const email = `email-${WorkerData.id}@domain.com`;
            const password = "testAbc123456";

            TestUtils.setPermanentEnvironment("userMode", "platform");

            // const organization = await new OrganizationFactory({
            //     name: `Vereniging${WorkerData.id}`,
            // }).create();

            const user = await new UserFactory({
                firstName: `Firstname${WorkerData.id}`,
                lastName: `Lastname${WorkerData.id}`,
                email,
                password,
                // organization,
            }).create();

            // create token
            const token = await Token.createToken(user);
            const tokenString = JSON.stringify(
                new TokenStruct(token).encode({ version: Version }),
            );

            await WorkerData._initLoginState({ user });

            // store token in local storage of context
            const context = await browser.newContext({
                storageState: {
                    cookies: [],
                    origins: [
                        {
                            origin: WorkerData.urls.dashboard,
                            localStorage: [
                                {
                                    name: "token-platform",
                                    value: tokenString,
                                },
                            ],
                        },
                    ],
                },
            });

            // save the context of the local storage
            await context.storageState({ path: fileName });
            await context.close();
            await use(fileName);
        },
        { scope: "worker" },
    ],
});
