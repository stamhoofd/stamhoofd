import chalk from 'chalk';
import { StyledText, Logger } from './logging.js';

let lastLog = '';
function createFakeStream() {
    return {
        write: (text: string) => {
            lastLog = text;
        },
        clearLine: () => {
            lastLog = '';
        },
    };
}

describe('Logging', () => {
    it('disables debug before formatting while preserving ordinary logs, warnings and errors', () => {
        const stdout: string[] = [];
        const stderr: string[] = [];
        const logger = new Logger({
            stdout: { write: text => stdout.push(text), clearLine: () => {} },
            stderr: { write: text => stderr.push(text), clearLine: () => {} },
        });
        logger.debug('default debug');
        logger.debugEnabled = false;
        const format = vi.fn(() => 'hidden');
        logger.debug(new StyledText({ toString: format }));
        expect(format).not.toHaveBeenCalled();
        logger.log('normal');
        logger.warn('warning');
        logger.error(new Error('failure'));
        expect(stdout).toEqual(['default debug\n', 'normal\n', 'warning\n']);
        expect(stderr.join('')).toContain('failure');
        logger.debugEnabled = true;
        logger.debug('verbose debug');
        expect(stdout.at(-1)).toBe('verbose debug\n');
    });

    it('routes console.debug through the current debug setting and context', () => {
        const original = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
        const logger = new Logger({ stdout: createFakeStream(), stderr: process.stderr });
        try {
            logger.infectConsole();
            logger.debugEnabled = false;
            lastLog = '';
            console.debug('hidden');
            expect(lastLog).toBe('');
            logger.debugEnabled = true;
            logger.setContext({ prefixes: [new StyledText('[context] ')] }, () => console.debug('visible'));
            expect(lastLog).toBe('[context] visible\n');
        } finally {
            Object.assign(console, original);
        }
    });

    it('Uses the style', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr,
        });
        logger.addClassStyle(['a', 'b'], ['dim', 'yellow']);
        logger.log(new StyledText('Hello').addClass('a', 'b'), ' Follow up');

        expect(lastLog).toBe(chalk.yellow.dim('Hello') + ' Follow up\n');
    });

    it('Uses the style in reverse order', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr,
        });
        logger.addClassStyle(['b', 'a'], ['dim', 'yellow']);
        logger.log(new StyledText('Hello').addClass('a', 'b'), ' Follow up');

        expect(lastLog).toBe(chalk.yellow.dim('Hello') + ' Follow up\n');
    });

    it('Uses the after style', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr,
        });
        logger.addClassAfterStyle(['b', 'a'], ['dim', 'yellow']);
        logger.log(new StyledText('Hello').addClass('a', 'b'), ' Follow up');

        expect(lastLog).toBe('Hello' + chalk.yellow.dim(' Follow up') + '\n');
    });

    it('Adds spaces between normal test', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr,
        });
        logger.log('a', 'b', 'c');
        expect(lastLog).toBe('a b c\n');
    });

    it('Does not add spaces between styled text', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr,
        });
        logger.log('a', new StyledText('b'), 'c', 'd');
        expect(lastLog).toBe('abc d\n');
    });
});
