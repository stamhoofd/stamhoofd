import chalk from 'chalk';
import { successSymbol } from '../config/shared-service-config.js';

export enum CliStatus {
    Checking = 'checking',
    Ready = 'ready',
    Running = 'running',
    Stopped = 'stopped',
    Missing = 'missing',
    Failed = 'failed',
}

export function formatStatusLabel(status: CliStatus): string {
    switch (status) {
        case CliStatus.Checking:
            return chalk.cyan('checking');
        case CliStatus.Ready:
            return `${chalk.green(successSymbol)} ${chalk.green('ready')}`;
        case CliStatus.Running:
            return `${chalk.green(successSymbol)} ${chalk.green('running')}`;
        case CliStatus.Stopped:
            return `${chalk.yellow('!')} ${chalk.yellow('stopped')}`;
        case CliStatus.Missing:
            return `${chalk.yellow('!')} ${chalk.yellow('missing')}`;
        case CliStatus.Failed:
            return `${chalk.red('✖')} ${chalk.red('failed')}`;
    }
}
