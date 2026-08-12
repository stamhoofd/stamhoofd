import { Email } from '@stamhoofd/email';
import { Formatter } from '@stamhoofd/utility';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Problems above this are only counted: a flood is one cause repeated per item, so listing them
 * all adds nothing.
 */
const MAXIMUM_LISTED_PROBLEMS = 20;

/**
 * Collects the problems of one run (a settlement sync, an invoicing round) into a single webmaster
 * email instead of one email per failing item.
 *
 * Reporting outside a `group` still sends its own email right away: a caller that forgets to group
 * mails too much, never too little.
 */
export class WebmasterReport {
    static #current = new AsyncLocalStorage<WebmasterReport>();

    readonly #subject: string;
    readonly #problems: string[] = [];
    #count = 0;
    #sent = false;

    private constructor(subject: string) {
        this.#subject = subject;
    }

    /**
     * Emails everything the handler reported after it finished, also when it throws.
     */
    static async group<T>(subject: string, handler: () => Promise<T>): Promise<T> {
        const report = new WebmasterReport(subject);
        try {
            return await this.#current.run(report, handler);
        } finally {
            report.#send();
        }
    }

    static report(title: string, detail?: unknown) {
        if (this.#current.getStore()?.collect(title, detail)) {
            return;
        }

        Email.sendWebmaster({
            subject: title,
            html: describeProblem(title, detail),
        });
    }

    /**
     * Returns false when this report was already sent, so the problem still gets its own email.
     */
    collect(title: string, detail?: unknown): boolean {
        if (this.#sent) {
            return false;
        }

        this.#count += 1;
        if (this.#problems.length < MAXIMUM_LISTED_PROBLEMS) {
            this.#problems.push(describeProblem(title, detail));
        }
        return true;
    }

    #send() {
        this.#sent = true;

        if (this.#count === 0) {
            return;
        }

        const notListed = this.#count - this.#problems.length;

        Email.sendWebmaster({
            subject: this.#subject + ': ' + this.#count + (this.#count === 1 ? ' probleem' : ' problemen'),
            html: this.#problems.join('<br><br>')
                + (notListed > 0
                    ? '<br><br>' + (notListed === 1
                        ? 'En nog 1 ander probleem dat niet in deze mail past.'
                        : 'En nog ' + notListed + ' andere problemen die niet in deze mail passen.')
                    : ''),
        });
    }
}

function describeProblem(title: string, detail: unknown): string {
    const description = describe(detail);
    return '<strong>' + escapeLines(title) + '</strong>' + (description ? '<br>' + description : '');
}

function describe(detail: unknown): string | null {
    if (detail === undefined || detail === null) {
        return null;
    }
    if (typeof detail === 'string') {
        return escapeLines(detail);
    }
    if (detail instanceof Error) {
        // Aggregates (SimpleErrors) put one message per line
        return escapeLines(detail.toString());
    }
    try {
        return escapeLines(JSON.stringify(detail) ?? 'Onbekend probleem');
    } catch {
        // Circular structures, BigInt, ...: never fail the error boundary that reports the problem
        return 'Onbekend probleem';
    }
}

function escapeLines(text: string): string {
    return Formatter.escapeHtml(text).replace(/\n/g, '<br>');
}
