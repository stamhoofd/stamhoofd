import { STChildProcess } from './STChildProcess.js';

export class FrontendBuilder {
    async build() {
        console.log('Start building frontend...');

        const childProcess = new STChildProcess(
            'pnpm',
            ['--workspace-root', 'exec', 'turbo', 'run', 'build:playwright', '--filter=@stamhoofd/web-app', '--filter=@stamhoofd/webshop'],
            {
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                    STAMHOOFD_ENV: 'playwright',
                },
            },
        );
        childProcess.enableLog();

        await childProcess;
        console.log('Done building frontend.');
    }
}
