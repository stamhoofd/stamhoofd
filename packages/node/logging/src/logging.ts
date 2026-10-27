import { AsyncLocalStorage } from 'node:async_hooks';
import chalk from 'chalk';
import { Direction } from 'node:readline';

type Modifier = (typeof chalk.Color | typeof chalk.Modifiers);
type Writeable = { write: (msg: string) => void; clearLine: (dir: Direction) => void };
type Context = { prefixes?: unknown[]; tags?: string[] };

export class StyledText {
    text: unknown;
    style?: Modifier[];
    classes: string[] = [];
    tags: string[] = [];

    /**
     * Set the style for the text that is printed after this text
     */
    afterStyle?: Modifier[];

    constructor(text: unknown, style?: Modifier[]) {
        this.text = text;
        this.style = style;
    }

    addClass(...classes: string[]): this {
        this.classes = [...this.classes, ...classes];
        return this;
    }

    addStyle(...styles: Modifier[]): this {
        this.style = [...(this.style ?? []), ...styles];
        return this;
    }

    addTag(...tags: string[]): this {
        this.tags = [...this.tags, ...tags];
        return this;
    }

    /**
     * Set the style for the text that is printed after this text
     */
    addAfterStyle(...styles: Modifier[]): this {
        this.afterStyle = [...(this.afterStyle ?? []), ...styles];
        return this;
    }

    toString(logger?: Logger): string {
        let text: string;
        if (typeof this.text === 'object') {
            if (this.text instanceof Error) {
                return this.text.toString() + (this.text.stack ? '\n' + this.text.stack : '');
            }
            text = JSON.stringify(this.text, undefined, '  ');
        } else {
            if (Array.isArray(this.text)) {
                if (logger) {
                    return logger.getText(this.text) ?? '';
                }
                text = this.text.join(' ');
            }
            if (typeof this.text === 'string' || typeof this.text === 'number' || typeof this.text === 'boolean') {
                if (typeof this.text === 'number' && isNaN(this.text)) {
                    text = 'NaN';
                } else {
                    text = this.text?.toString();
                }
            } else {
                if (this.text === null) {
                    text = 'null';
                } else if (this.text === undefined) {
                    text = 'undefined';
                } else {
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    text = this.text + '';
                }
            }
        }
        return text;
    }

    toStyledString(logger: Logger): string {
        let text = this.toString(logger);
        const styles = this.getStyles(logger);

        for (const s of styles) {
            text = chalk[s](text);
        }
        return text;
    }

    getStyles(logger: Logger): Modifier[] {
        const styles = this.style?.slice() ?? [];
        styles.push(...getStylesForClasses(this.classes, logger.classStyles));
        return styles;
    }

    getAfterStyle(logger: Logger): Modifier[] {
        const styles = this.afterStyle?.slice() ?? [];
        styles.push(...getStylesForClasses(this.classes, logger.afterClassStyles));
        return styles;
    }
}

type RecursiveClassStyles = Map<string, { style: Modifier[]; with: RecursiveClassStyles }>;

function registerClass(name: string[], map: RecursiveClassStyles, style: Modifier[]) {
    const first = name[0];
    if (!first) {
        return;
    }

    if (name.length === 1) {
        map.set(first, {
            style: [...(map.get(first)?.style ?? []), ...style],
            with: map.get(first)?.with ?? new Map() as RecursiveClassStyles,
        });
        return;
    }

    const w = (map.get(first)?.with ?? new Map()) as RecursiveClassStyles;

    map.set(first, {
        style: map.get(first)?.style ?? [],
        with: w,
    });

    registerClass(name.slice(1), w, style);
}

function getStylesForClasses(classes: string[], map: RecursiveClassStyles): Modifier[] {
    const styles: Modifier[] = [];
    for (const cls of classes) {
        const classStyles = map.get(cls);
        if (classStyles) {
            if (classStyles.style) {
                styles.push(...classStyles.style);
            }

            if (classStyles.with) {
                styles.push(...getStylesForClasses(classes, classStyles.with));
            }
        }
    }
    return styles;
}

export class Logger {
    stdout: Writeable;
    stderr: Writeable;
    asyncLocalStorage = new AsyncLocalStorage<Context>();
    classStyles: RecursiveClassStyles = new Map();
    afterClassStyles: RecursiveClassStyles = new Map();
    hiddenTags: Set<string> = new Set();

    constructor({ stdout, stderr }: { stdout: Writeable; stderr: Writeable }) {
        this.stdout = stdout;
        this.stderr = stderr;
    }

    /**
     * Define text styles for text that matches a given class
     */
    addClassStyle(name: string[], style: Modifier[]): void {
        registerClass(name, this.classStyles, style);
    }

    /**
     * Define text styles for text after text that matches a given class
     */
    addClassAfterStyle(name: string[], style: Modifier[]): void {
        registerClass(name, this.afterClassStyles, style);
    }

    hideTags(...tags: string[]): void {
        for (const tag of tags) {
            this.hiddenTags.add(tag);
        }
    }

    unhideTags(...tags: string[]): void {
        for (const tag of tags) {
            this.hiddenTags.delete(tag);
        }
    }

    private getContext(): Context {
        return this.asyncLocalStorage.getStore() ?? {};
    }

    setContext<T>(context: Context, callback: () => T): T {
        return this.asyncLocalStorage.run(context, callback);
    }

    getText(args: unknown[], context?: Context): string | undefined {
        for (const tag of context?.tags ?? []) {
            if (this.hiddenTags.has(tag)) {
                return;
            }
        }

        let stack = '';
        let afterStyle: Modifier[] = [];
        let addSpace = false;
        for (const arg of [...(context?.prefixes ?? []), ...args]) {
            if (arg instanceof StyledText) {
                for (const tag of arg.tags ?? []) {
                    if (this.hiddenTags.has(tag)) {
                        return;
                    }
                }

                stack += arg.toStyledString(this);
                afterStyle = arg.getAfterStyle(this);
                addSpace = false;
            } else {
                if (addSpace) {
                    stack += ' ';
                }
                stack += new StyledText(arg, afterStyle).toStyledString(this);
                addSpace = true;
            }
        }
        return stack;
    }

    isInProgress = false;

    clearProgress(): void {
        if (this.isInProgress) {
            this.stdout.write('\n');
            this.isInProgress = false;
        }
    }

    progress(...args: any[]): void {
        const text = this.getText(args, this.getContext());
        if (text === undefined) {
            return;
        }

        if (this.isInProgress) {
            this.stdout.clearLine(0);
        }
        this.isInProgress = true;
        this.stdout.write(text.replace(/\n/g, ' '));
    }

    log(...args: unknown[]): void {
        const text = this.getText(args, this.getContext());
        if (text === undefined) {
            return;
        }

        this.clearProgress();
        this.stdout.write(text + '\n');
    }

    warn(...args: unknown[]): void {
        const text = this.getText(args, this.getContext());
        if (text === undefined) {
            return;
        }

        this.clearProgress();
        this.stdout.write(text + '\n');
    }

    error(...args: unknown[]): void {
        const text = this.getText(args, this.getContext());
        if (text === undefined) {
            return;
        }

        this.clearProgress();
        this.stderr.write(text + '\n');
    }

    /**
     * Override the console methods with the logger
     */
    infectConsole(): void {
        console.log = (...args: any[]) => this.log(...args);
        console.warn = (...args: any[]) => this.warn(...args);
        console.error = (...args: any[]) => this.error(...args);
        console.info = (...args: any[]) => this.log(...args);
        console.debug = (...args: any[]) => this.log(...args);
    }
}
