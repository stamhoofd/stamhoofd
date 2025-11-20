import { ChildProcessHelper } from "./ChildProcessHelper";

export class FrontendBuilder {
    async build() {
        console.log('Start building frontend...')

        const childProcess = ChildProcessHelper.spawnWithCleanup(
            "yarn",
            ["lerna", "run", "build:playwright", "--stream", "--parallel"],
            {
                env: {
                    ...process.env,
                    NODE_ENV: "test",
                    STAMHOOFD_ENV: "playwright",
                },
            },
        );

        await ChildProcessHelper.await(childProcess);
        console.log('Done building frontend.')
    }
}
