import { Logger } from './src/logging.js';

export * from './src/logging.js';

export const logger = new Logger({
    stdout: process.stdout,
    stderr: process.stderr,
});
