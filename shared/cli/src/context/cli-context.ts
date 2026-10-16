import type { RunVerbosity } from '../runtime/command-runner.js';

export type CliContext = {
    rootDir: string;
    generatedDir: string;
    env: string;
    workspace: string;
    verbose: boolean;
    verbosity?: RunVerbosity;
    instance: {
        name: string;
        prefix: string;
        primary: boolean;
        portOffset: number;
    };
};
