import { Logger } from './src/logging';

export * from './src/logging';

export const logger = new Logger({
    stdout: process.stdout,
    stderr: process.stderr,
});
