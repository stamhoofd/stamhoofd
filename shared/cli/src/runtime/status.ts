import chalk from 'chalk';
import { successSymbol } from '../config/shared-service-config.js';

export type CliStatus = 'checking' | 'ready' | 'running' | 'stopped' | 'missing' | 'failed';

export function formatStatusLabel(status: CliStatus): string {
    switch (status) {
        case 'checking':
            return chalk.cyan('checking');
        case 'ready':
            return `${chalk.green(successSymbol)} ${chalk.green('ready')}`;
        case 'running':
            return `${chalk.green(successSymbol)} ${chalk.green('running')}`;
        case 'stopped':
            return `${chalk.yellow('!')} ${chalk.yellow('stopped')}`;
        case 'missing':
            return `${chalk.yellow('!')} ${chalk.yellow('missing')}`;
        case 'failed':
            return `${chalk.red('✖')} ${chalk.red('failed')}`;
    }
}
