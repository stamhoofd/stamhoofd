// First import test
import { setup as originalSetup, test } from './base.js';
export { test } from './base.js';

// All other imports perferably later
import { Token, UserFactory } from '@stamhoofd/models';
import { Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import fs from 'fs';
import path from 'path';
import { Logger, WorkerData } from '../helpers/index.js';

export function setup() {
    originalSetup();

    const getFileName = () => path.resolve(
        test.info().project.outputDir,
        `.auth/${WorkerData.id}.json`,
    );

    test.beforeAll(async ({ browser }, testInfo) => {
        Logger.info('BEFORE ALL platform' + testInfo.file);
        const fileName = getFileName();

        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }
        const email = `email-${WorkerData.id}@domain.com`;
        const password = 'testAbc123456';

        TestUtils.setPermanentEnvironment('userMode', 'platform');

        const user = await new UserFactory({
            firstName: `Firstname${WorkerData.id}`,
            lastName: `Lastname${WorkerData.id}`,
            email,
            password,
        }).create();

        // create token
        const token = await Token.createToken(user);
        const tokenString = JSON.stringify(
            new TokenStruct(token).encode({ version: Version }),
        );

        await WorkerData.initLoginState({ user });

        // store token in local storage of context
        const context = await browser.newContext({
            storageState: {
                cookies: [],
                origins: [
                    {
                        origin: WorkerData.urls.dashboard,
                        localStorage: [
                            {
                                name: 'token-platform',
                                value: tokenString,
                            },
                        ],
                    },
                ],
            },
        });

        // save the context of the local storage
        await context.storageState({ path: fileName });
    });

    test.use({
        // eslint-disable-next-line no-empty-pattern
        storageState: ({}, use) => use(getFileName()),
    });
}
