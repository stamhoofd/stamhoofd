// First import test
import { setup as originalSetup, test } from './base.js';
export { test } from './base.js';

// All other imports perferably later
import { SessionService } from '@stamhoofd/backend/services/SessionService';
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

    // eslint-disable-next-line no-empty-pattern
    test.beforeAll(async ({}, testInfo) => {
        Logger.info('BEFORE ALL platform' + testInfo.file);
        const started = performance.now();
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
        const seedFinished = performance.now();
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(
            new TokenStruct(token).encode({ version: Version }),
        );

        await WorkerData.initLoginState({ user });
        const sessionFinished = performance.now();

        fs.mkdirSync(path.dirname(fileName), { recursive: true });
        fs.writeFileSync(fileName, JSON.stringify({
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
        }));
        const storageStateFinished = performance.now();

        await testInfo.attach('platform-auth-timings', {
            body: JSON.stringify({
                seedMs: seedFinished - started,
                sessionMs: sessionFinished - seedFinished,
                storageStateMs: storageStateFinished - sessionFinished,
            }),
            contentType: 'application/json',
        });
    });

    test.use({
        // eslint-disable-next-line no-empty-pattern
        storageState: ({}, use) => use(getFileName()),
    });
}
