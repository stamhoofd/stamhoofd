import { Logger } from './src/logging.js';

export * from './src/logging.js';
export * from './src/backend-record.js';

export const logger = new Logger({
    stdout: process.stdout,
    stderr: process.stderr,
});
