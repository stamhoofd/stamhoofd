import { Command } from 'commander';
import { autoTranslate } from './auto-translate/auto-translate.js';
import { filterInvalidAutoTranslations, loopAndPromptValidateInvalidTranslations } from './auto-translate/AutoTranslatorPostValidator.js';
import { createAutoTranslateComparison } from './auto-translate/create-auto-translate-comparison.js';
import { fixDoubleTranslations } from './auto-translate/fix-double-translations.js';
import { replaceKeys } from './replace-keys/replace-keys.js';
import { fileCache } from './replace-text/FileCache.js';
import { replaceText } from './replace-text/replace-text.js';
import { unusedKeys } from './replace-keys/unused-keys.js';
import { mergeDuplicates } from './replace-keys/merge-duplicates.js';
import { compressUuids } from './replace-keys/compress-uuids.js';

const program = new Command();

const replaceTextOptions: [string, string][] = [
    ['--commits <commits...>', 'Git commits to compare'],
    ['-c, --changes', 'Only the changed files will be checked.'],
    [
        '--attribute-white-list <attributes...>',
        'Array of html attributes to white list. Text of other attributes will not be checked.',
    ],
    ['--dry-run', 'Do not write the translated files.'],
    [
        '-p, --prompt',
        'The prompt will show the code before and after the replacement and ask to accept the change.',
    ],
    ['-f, --fix', 'Fix the changed files with ESLint (can be slow).'],
];

const autoTranslateOptions: [string, string][] = [
    [
        '--fake',
        'Translate the misssing translations with a fake translation (for testing purposes).',
    ],
    [
        '--translator <translator-type>',
        'The translator type (GoogleGemini, MistralLarge, MistralSmall, OpenAi or Claude).',
    ],
    [
        '--locales <locales...>',
        'Specify the locals to translate (by default translations for all locals will be added).',
    ],
];

const startOptions = replaceTextOptions.concat(autoTranslateOptions);

const startCommand = program.command('start').action(async (args) => {
    // replace text
    await replaceText(args);

    // replace keys
    replaceKeys();

    // auto-translate
    await autoTranslate(args);

    // create comparison
    createAutoTranslateComparison();
});
startOptions.forEach(([flags, description]) =>
    startCommand.option(flags, description),
);

const replaceTextCommand = program
    .command('replace-text')
    .action(async (args) => {
        await replaceText(args);
    });

replaceTextOptions.forEach(([flags, description]) =>
    replaceTextCommand.option(flags, description),
);

program
    .command('clear-cache')
    .action(async (args) => {
        console.log('start clear cache...');
        fileCache.clear();
        console.log('cleared cache');
    });

program.command('replace-keys').action(() => replaceKeys());
program.command('unused-keys').action(() => unusedKeys());
program.command('merge-duplicates').action(() => mergeDuplicates());
program.command('compress-uuids').action(() => compressUuids());

const autoTranslateCommand = program
    .command('auto-translate')
    .action(async (args) => {
        await autoTranslate(args);
    });

autoTranslateOptions.forEach(([flags, description]) =>
    autoTranslateCommand.option(flags, description),
);

const filterInvalidAutoTranslationsCommand = program
    .command('filter-invalid-auto-translations')
    .action(async (args) => {
        filterInvalidAutoTranslations(args);
    });

filterInvalidAutoTranslationsCommand.option('--dry-run', 'Do not remove the invalid auto translations.');

const loopInvalidAutoTranslationsCommand = program
    .command('loop-invalid-auto-translations')
    .action(async (args) => {
        await loopAndPromptValidateInvalidTranslations(args);
    });

loopInvalidAutoTranslationsCommand.option('--dry-run', 'Do not remove the invalid auto translations.');

const fixDoubleTranslationsCommand = program
    .command('fix-double-translations')
    .action(async (args) => {
        fixDoubleTranslations();
    });

program
    .command('create-comparison')
    .action(() => createAutoTranslateComparison());

program.parse(process.argv);

program.opts();
