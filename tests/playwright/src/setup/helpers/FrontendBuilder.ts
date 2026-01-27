import { STChildProcess } from './STChildProcess';

export class FrontendBuilder {
    async build() {
        console.log('Start building frontend...');

        const childProcess = new STChildProcess(
            'yarn',
            ['lerna', 'run', 'build:playwright', '--stream', '--parallel'],
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
