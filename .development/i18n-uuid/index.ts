import { Command } from "commander";
import { autoTranslate } from "./src/auto-translate/auto-translate";
import { createAutoTranslateComparison } from "./src/auto-translate/create-auto-translate-comparison";
import { replaceKeys } from "./src/replace-keys/replace-keys";
import { replaceText } from "./src/replace-text/replace-text";

const program = new Command();

const replaceTextOptions: [string, string][] = [
    ["--compare <commits...>", "Commits to compare"],
    ["-c, --changes", "Only the changed files will be checked."],
    [
        "--attribute-white-list <attributes...>",
        "Array of html attributes to white list. Text of other attributes will not be checked.",
    ],
    ["--dry-run", "Do not write the translated files."],
    [
        "-p, --prompt",
        "The prompt will show the code before and after the replacement and ask to accept the change.",
    ],
    ["-f, --fix", "Fix the changed files with ESLint (can be slow)."],
];

const replaceKeysOptions: [string, string][] = [
    [
        "--fake",
        "Translate the misssing translations with a fake translation (for testing purposes).",
    ],
    [
        "--translator <translator-type>",
        "The translator type (GoogleGemini, MistralLarge, MistralSmall, OpenAi or Claude).",
    ],
    [
        "--locales <locales...>",
        "Specify the locals to translate (by default translations for all locals will be added).",
    ],
];

const startOptions = replaceTextOptions.concat(replaceKeysOptions);

const startCommand = program.command("start").action(async (args) => {
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
    .command("replace-text")
    .action(async (args) => {
        await replaceText(args);
    });

replaceTextOptions.forEach(([flags, description]) =>
    replaceTextCommand.option(flags, description),
);

program.command("replace-keys").action(() => replaceKeys());

const replaceKeysCommand = program
    .command("auto-translate")
    .action(async (args) => {
        await autoTranslate(args);
    });

replaceKeysOptions.forEach(([flags, description]) =>
    replaceKeysCommand.option(flags, description),
);

program
    .command("create-comparison")
    .action(() => createAutoTranslateComparison());

program.parse(process.argv);

program.opts();
