# i18n uuid
This module:
- finds untranslated text in Vue templates and replaces them with a translation function
- searches translation keys, replaces the key with an uuid key and adds the key to the translations
- finds missing or changed translations and translates them with an Ai-model
- creates a comparison of the machine translations for each locale and writes the comparison in the output directory

## commands

### start
Executes all commands in order. The arguments of each command can be passed.

### replace-text
Search untranslated text in Vue templates and replaces them with a translation function.

#### arguments
- `--commits <commits...>`: Git commits to compare
- `-c, --changes`: Only the changed files will be checked.
- `--attribute-white-list <attributes...>`: Array of html attributes to white list. Text of other attributes will not be checked.
- `--dry-run`: Do not write the translated files.
- `-p, --prompt`: The prompt will show the code before and after the replacement and ask to accept the change.
- `-f, --fix`: Fix the changed files with ESLint (can be slow).

### replace-keys
Search translation keys, replace the key with an uuid key and add the key to the translations.

### auto-translate
Finds missing or changed translations and translate with an Ai-model.

#### arguments
- `--fake`: Translate the misssing translations with a fake translation (for testing purposes).
- `--translator <translator-type>`: The translator type (GoogleGemini, MistralLarge, MistralSmall, OpenAi or Claude).
- `--locales <locales...>`: Specify the locals to translate (by default translations for all locals will be added).

### loop-invalid-auto-translations
Loop all invalid auto translations. Choose with a prompt if the translation is correct. If the translation is correct it will be added to the translations and removed from the auto translations, if not it will be removed from the machine translations. In case of doubt (key 'd'), the translation will remain in the machine translations.

#### arguments
- `--dry-run`: Do not remove the invalid auto translations.

### create-comparison
Create a comparison of the machine translations for each locale and write the comparison in the output directory.

## Environment variables
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `MISTRAL_API_KEY`
