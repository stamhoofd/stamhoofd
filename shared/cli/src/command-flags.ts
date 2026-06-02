import { Flags } from '@oclif/core';

export const verboseFlag = Flags.boolean({
    description: 'Print extra diagnostics while running',
    default: false,
});

export const servicesOptionFlag = Flags.boolean({
    allowNo: true,
    description: 'Start shared services before the selected target',
});

export const stripeFlag = Flags.boolean({
    allowNo: true,
    default: false,
    description: 'Start a Stripe listener for the selected instance',
});

export const yesFlag = Flags.boolean({
    char: 'y',
    default: false,
    description: 'Skip confirmation prompts',
});

export const dryRunFlag = Flags.boolean({
    default: false,
    description: 'Preview changes without applying them',
});

export const openFlag = Flags.boolean({
    default: false,
    description: 'Open the dashboard in your browser',
});

export const ciFlag = Flags.boolean({
    default: false,
    description: 'Run in non-interactive CI-style mode',
});
