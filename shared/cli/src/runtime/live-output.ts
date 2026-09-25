import chalk from 'chalk';
import { StdSync } from '@stamhoofd/stdsync';
import { OutputStream } from './output-target.js';
import { link } from './ux.js';

export enum StatusItemKind {
    Text = 'text',
    Success = 'success',
    Muted = 'muted',
    Warning = 'warning',
}

export type StatusItem = {
    label: string;
    href?: string;
    kind?: StatusItemKind;
};

export type LiveOutput = {
    setStatus(items: StatusItem[]): void;
    setLiveStatus(getItems: (frame: number) => StatusItem[], options?: { intervalMs?: number }): void;
    stopLiveStatus(): void;
    log(message: string): void;
    write(chunk: string | Buffer, stream?: OutputStream): void;
    clearStatus(): void;
    stop(options?: { persistStatus?: boolean }): void;
};

export function createLiveOutput(options: {
    enabled?: boolean;
    stdout?: NodeJS.WriteStream;
    stderr?: NodeJS.WriteStream;
} = {}): LiveOutput {
    const stdout = options.stdout ?? process.stdout;
    const stderr = options.stderr ?? process.stderr;
    const interactive = (options.enabled ?? true) && stdout.isTTY;
    const output = new StdSync({ stdout, stderr });
    let renderedStatus = '';
    let staticStatusPrinted = false;
    let liveStatusInterval: NodeJS.Timeout | undefined;
    let liveStatusRenderer: ((frame: number) => StatusItem[]) | undefined;
    let liveStatusFrame = 0;

    const renderStatus = () => {
        if (!renderedStatus) {
            return;
        }
        if (interactive) {
            output.setLive(renderedStatus);
            return;
        }
        if (!staticStatusPrinted) {
            stdout.write(`${renderedStatus}\n`);
            staticStatusPrinted = true;
        }
    };

    const stopLiveStatus = () => {
        if (!liveStatusInterval) {
            return;
        }
        clearInterval(liveStatusInterval);
        liveStatusInterval = undefined;
        liveStatusRenderer = undefined;
        liveStatusFrame = 0;
    };

    const applyStatus = (items: StatusItem[]) => {
        renderedStatus = items
            .map(item => formatStatusItem(item))
            .filter(Boolean)
            .join('  ');
        staticStatusPrinted = false;
        renderStatus();
    };

    return {
        setStatus(items) {
            stopLiveStatus();
            applyStatus(items);
        },
        setLiveStatus(getItems, options = {}) {
            stopLiveStatus();
            liveStatusRenderer = getItems;
            liveStatusFrame = 0;
            applyStatus(getItems(liveStatusFrame));

            if (!interactive) {
                return;
            }

            liveStatusInterval = setInterval(() => {
                if (!liveStatusRenderer) {
                    return;
                }
                liveStatusFrame++;
                applyStatus(liveStatusRenderer(liveStatusFrame));
            }, options.intervalMs ?? 80);
        },
        stopLiveStatus() {
            stopLiveStatus();
        },
        log(message) {
            output.write(`${message}\n`);
        },
        write(chunk, stream = OutputStream.Stdout) {
            output.write(chunk, stream);
        },
        clearStatus() {
            stopLiveStatus();
            renderedStatus = '';
            staticStatusPrinted = false;
            output.clearLive();
        },
        stop(options = {}) {
            stopLiveStatus();
            if (!interactive) {
                return;
            }
            if (options.persistStatus) {
                output.done();
                renderedStatus = '';
                staticStatusPrinted = false;
                return;
            }
            output.clearLive();
            renderedStatus = '';
            staticStatusPrinted = false;
        },
    };
}

function formatStatusItem(item: StatusItem): string {
    const label = item.label.trim();
    if (!label) {
        return '';
    }
    const formattedLabel = item.href ? link(label, item.href) : label;

    if (item.kind === StatusItemKind.Success) {
        return chalk.green(formattedLabel);
    }
    if (item.kind === StatusItemKind.Muted) {
        return chalk.dim(formattedLabel);
    }
    if (item.kind === StatusItemKind.Warning) {
        return chalk.yellow(formattedLabel);
    }
    return formattedLabel;
}
