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

export type Cell<Value extends string = string> = {
    value: Value;
    indeterminate?: boolean;
};

export type TableCellInput = string | Cell;

export type TableRow = {
    update(cells: TableCellInput[]): void;
    hasIndeterminateCells(): boolean;
};

type TableRowListener = () => void;

class TableRowImpl implements TableRow {
    private cells: Cell[];
    private listeners: TableRowListener[] = [];

    constructor(cells: TableCellInput[]) {
        this.cells = cells.map(normalizeCell);
    }

    update(cells: TableCellInput[]): void {
        this.cells = cells.map(normalizeCell);
        this.listeners.forEach(listener => listener());
    }

    hasIndeterminateCells(): boolean {
        return this.cells.some(cell => cell.indeterminate === true);
    }

    formattedCells(frame: number): string[] {
        return this.cells.map(cell => cell.indeterminate ? spinnerCell(cell.value, frame) : cell.value);
    }

    onUpdate(listener: TableRowListener): void {
        this.listeners.push(listener);
    }
}

export class Table {
    private readonly headers: string[];
    private readonly rows: TableRowImpl[];
    private readonly title?: string;
    private readonly live: boolean;
    private readonly stdout: NodeJS.WriteStream;
    private frame = 0;
    private lines = 0;
    private stopped = false;
    private interval: NodeJS.Timeout | undefined;
    private resolveWait: (() => void) | undefined;
    private waitPromise: Promise<void> | undefined;

    private constructor(options: { title?: string; headers: string[]; rows: TableRow[]; live?: boolean; intervalMs?: number }) {
        this.headers = options.headers;
        this.rows = options.rows.map((row) => {
            if (!(row instanceof TableRowImpl)) {
                throw new Error('Rows passed to Table.create must be created with Table.row().');
            }
            return row;
        });
        this.title = options.title;
        this.live = options.live === true && process.stdout.isTTY;
        this.stdout = process.stdout;

        this.rows.forEach(row => row.onUpdate(() => this.handleRowUpdate()));

        if (this.live) {
            this.render();
            this.interval = setInterval(() => this.render(), options.intervalMs ?? 80);
        }
    }

    static cell<Value extends string>(value: Value, options: { indeterminate?: boolean } = {}): Cell<Value> {
        return { value, ...options };
    }

    static row(cells: TableCellInput[]): TableRow {
        return new TableRowImpl(cells);
    }

    static create(options: { title?: string; headers: string[]; rows: TableRow[]; live?: boolean; intervalMs?: number }): Table {
        return new Table(options);
    }

    async wait(): Promise<void> {
        if (!this.hasIndeterminateCells()) {
            this.stop();
            return;
        }

        this.waitPromise ??= new Promise<void>((resolve) => {
            this.resolveWait = resolve;
        });

        await this.waitPromise;
    }

    private handleRowUpdate(): void {
        if (this.stopped) {
            return;
        }
        if (this.live) {
            this.render();
        }
        if (!this.hasIndeterminateCells() && (this.live || this.resolveWait)) {
            this.stop();
            this.resolveWait?.();
            this.resolveWait = undefined;
        }
    }

    private hasIndeterminateCells(): boolean {
        return this.rows.some(row => row.hasIndeterminateCells());
    }

    private stop(): void {
        if (this.stopped) {
            return;
        }

        this.stopped = true;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        this.render(true);
    }

    private render(force = false): void {
        if (this.stopped && !force) {
            return;
        }

        const output = formatTable(this.headers, this.rows.map(row => row.formattedCells(this.frame)), { title: this.title });
        if (!this.live) {
            writeOutputLine(output);
            return;
        }

        if (this.lines > 0) {
            readline.moveCursor(this.stdout, 0, -this.lines);
            readline.clearScreenDown(this.stdout);
        }
        this.stdout.write(`${output}\n`);
        this.lines = output.split('\n').length;
        this.frame++;
    }
}

export function table(headers: string[], rows: string[][], options: { title?: string } = {}): void {
    const table = Table.create({ headers, rows: rows.map(row => Table.row(row)), title: options.title, live: false });
    void table.wait();
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

function normalizeCell(cell: TableCellInput): Cell {
    return typeof cell === 'string' ? { value: cell } : cell;
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
