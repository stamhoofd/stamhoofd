import { ProcessHelper } from "./ProcessHelper";

export class FrontendBuilder {
    async build() {
        console.log('Start building frontend...')

        const childProcess = ProcessHelper.spawnWithCleanup(
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

        await ProcessHelper.awaitChild(childProcess);
        console.log('Done building frontend.')
    }
}
