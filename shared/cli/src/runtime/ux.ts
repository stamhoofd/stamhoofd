import { confirm as confirmPrompt } from '@inquirer/prompts';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import ora from 'ora';
import terminalLink from 'terminal-link';
import { stripVTControlCharacters } from 'node:util';
import { successSymbol } from '../config/shared-service-config.js';
import { OutputStream, writeOutputLine } from './output-target.js';
import { CliStatus, formatStatusLabel } from './status.js';

const spinnerFrames = ['-', '\\', '|', '/'];

export function info(message: string): void {
    writeOutputLine(message);
}

export function success(message: string): void {
    writeOutputLine(`${chalk.green(successSymbol)} ${message}`);
}

export function warning(message: string): void {
    writeOutputLine(`${chalk.yellow('!')} ${message}`);
}

export function failure(message: string): void {
    writeOutputLine(`${chalk.red('✖')} ${message}`, OutputStream.Stderr);
}

export async function step<T>(message: string, fn: () => Promise<T>, options: { successMessage?: (result: T) => string } = {}): Promise<T> {
    const spinner = ora(message).start();
    try {
        const result = await fn();
        spinner.stopAndPersist({ symbol: chalk.green(successSymbol), text: options.successMessage?.(result) ?? message });
        return result;
    }
    catch (error) {
        spinner.fail(message);
        throw error;
    }
}

export async function confirm(message: string, options: { default?: boolean } = {}): Promise<boolean> {
    return await confirmPrompt({ message, default: options.default ?? false });
}

export function command(commandLine: string): string {
    return chalk.dim(commandLine);
}

export function link(label: string, url: string): string {
    return terminalLink(label, url, { fallback: () => url });
}

export function openUrl(url: string): void {
    const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {
        // Opening the browser is best-effort and should not crash the CLI.
    });
    child.unref();
}

export function table(headers: string[], rows: string[][], options: { title?: string } = {}): void {
    writeOutputLine(formatTable(headers, rows, options));
}

export function formatTable(headers: string[], rows: string[][], options: { title?: string } = {}): string {
    const widths = headers.map((header, index) => Math.max(header.length, ...rows.map(row => stripVTControlCharacters(row[index] ?? '').length)));
    const lines = [
        formatTableBorder(widths, TableBorderPosition.Top),
        formatTableRow(headers.map(header => chalk.bold(header)), widths),
        formatTableBorder(widths, TableBorderPosition.Middle),
    ];
    for (const row of rows) {
        lines.push(formatTableRow(row, widths));
    }
    lines.push(formatTableBorder(widths, TableBorderPosition.Bottom));

    return options.title ? `${chalk.bold(options.title)}\n${lines.join('\n')}` : lines.join('\n');
}

export function spinnerCell(message: string, frame: number): string {
    return `${chalk.cyan(spinnerFrames[frame % spinnerFrames.length])} ${message}`;
}

export function statusCell(status: CliStatus): string {
    return formatStatusLabel(status);
}

export function liveTable(headers: string[], getRows: (frame: number) => string[][], options: { intervalMs?: number } = {}): { stop: () => void } {
    if (!process.stdout.isTTY) {
        return { stop: () => table(headers, getRows(0)) };
    }

    let frame = 0;
    let lines = 0;
    let stopped = false;

    const render = (force = false) => {
        if (stopped && !force) {
            return;
        }

        const output = formatTable(headers, getRows(frame));
        if (lines > 0) {
            readline.moveCursor(process.stdout, 0, -lines);
            readline.clearScreenDown(process.stdout);
        }
        process.stdout.write(`${output}\n`);
        lines = output.split('\n').length;
        frame++;
    };

    render();
    const interval = setInterval(render, options.intervalMs ?? 80);

    return {
        stop: () => {
            stopped = true;
            clearInterval(interval);
            render(true);
        },
    };
}

function formatTableRow(row: string[], widths: number[]): string {
    return `│ ${row.map((cell, index) => cell.padEnd(widths[index] + ansiLength(cell))).join(' │ ')} │`;
}

enum TableBorderPosition {
    Top = 'top',
    Middle = 'middle',
    Bottom = 'bottom',
}

function formatTableBorder(widths: number[], position: TableBorderPosition): string {
    const [left, join, right] = position === TableBorderPosition.Top
        ? ['┌', '┬', '┐']
        : position === TableBorderPosition.Middle
            ? ['├', '┼', '┤']
            : ['└', '┴', '┘'];
    return `${left}${widths.map(width => ''.padEnd(width + 2, '─')).join(join)}${right}`;
}

function ansiLength(value: string): number {
    return value.length - stripVTControlCharacters(value).length;
}
