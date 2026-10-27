import chalk from "chalk";
import { StyledText, Logger } from "./logging";

let lastLog = '';
function createFakeStream() {
    return {
        write: (text: string) => {
            lastLog = text;
        },
        clearLine: () => { 
            lastLog = '';
        }
    }
}

describe('Logging', () => {
    it('Uses the style', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr
        });
        logger.addClassStyle(['a', 'b'], ['dim', 'yellow']);
        logger.log(new StyledText('Hello').addClass('a', 'b'), ' Follow up')

        expect(lastLog).toBe(chalk.yellow.dim('Hello') + ' Follow up\n');
    })

    it('Uses the style in reverse order', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr
        });
        logger.addClassStyle(['b', 'a'], ['dim', 'yellow']);
        logger.log(new StyledText('Hello').addClass('a', 'b'), ' Follow up')

        expect(lastLog).toBe(chalk.yellow.dim('Hello') + ' Follow up\n');
    })

    it('Uses the after style', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr
        });
        logger.addClassAfterStyle(['b', 'a'], ['dim', 'yellow']);
        logger.log(new StyledText('Hello').addClass('a', 'b'), ' Follow up')

        expect(lastLog).toBe('Hello' + chalk.yellow.dim(' Follow up') + '\n');
    })

    it('Adds spaces between normal test', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr
        });
        logger.log('a', 'b', 'c');
        expect(lastLog).toBe('a b c\n');
    })

    it('Does not add spaces between styled text', () => {
        const logger = new Logger({
            stdout: createFakeStream(),
            stderr: process.stderr
        });
        logger.log('a', new StyledText('b'), 'c', 'd');
        expect(lastLog).toBe('abc d\n');
    })
});