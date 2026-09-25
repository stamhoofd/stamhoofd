import { setTimeout as sleep } from 'node:timers/promises';
import { StdSync } from '../dist/index.js';

if (!process.stdout.isTTY) {
    console.error('Run this example in a terminal: pnpm --dir shared/stdsync run example');
    process.exitCode = 1;
} else {
    const output = new StdSync();

    try {
        for (let step = 0; step <= 8; step++) {
            output.setLive([
                '┌────────────────┬──────────────┐',
                '│ Service        │ Status       │',
                '├────────────────┼──────────────┤',
                `│ Example        │ ${`${step}/8 complete`.padEnd(12)} │`,
                '└────────────────┴──────────────┘',
            ].join('\n'));

            if (step === 2) {
                console.log('stdout: a log stays above the live table');
            }
            if (step === 4) {
                console.error('stderr: errors stay visible too');
            }
            if (step === 6) {
                process.stdout.write('stdout: logs can arrive in ');
                await sleep(200);
                process.stdout.write('multiple chunks\n');
            }
            await sleep(250);
        }
    }
    finally {
        output.done();
    }

    console.log('Finished. The logs and final table remain visible.');
}
