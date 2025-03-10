# i18n uuid
This module:
- finds untranslated text in Vue templates and replaces them with a translation function
- searches translation keys, replaces the key with an uuid key and adds the key to the translations
- finds missing or changed translations and translates them with an Ai-model
- creates a comparison of the machine translations for each locale and writes the comparison in the directory that is specified in the environment

## commands

### start
Executes all commands in order. The arguments of each command can be passed.

### replace-text
Search untranslated text in Vue templates and replaces them with a translation function.

#### arguments
- `--compare <commits...>`: Git commits to compare
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

### create-comparison
Create a comparison of the machine translations for each locale and write the comparison in the directory that is specified in the environment.

## Environment variables
- `I18NUUID_ROOT`: the path to the root of the project
- `I18NUUID_LOCALES_DIR`: the path to the directory containing the translations
- `I18NUUID_LOCALES_DIR_DIST`: the path to the directory containing the built translations
- `DEFAULT_LOCALE`: default locale, for example nl-BE
- `DEFAULT_COUNTRY`: default country, for example BE
- `I18NUUID_EXCLUDE_DIRS_ARRAY`: directories to exclude seperated by a comma, for example: dist,esm,node_modules
- `DEFAULT_LOCALES`: an object with the configuration for the default locales. Each key is a language. Each value is another object with the optional key `countries` and the key `default`. Countries is an object where the keys are country codes and the values are an array of country codes. The key is the default country for the countries in the array. The value for default is the default country for all other countries that are not configured. For example: `'{"es":{"countries":{"CO":["CO"]},"default":"ES"},"en":{"default":"GB"},"nl":{"default":"BE"}}'`
- `TRANSLATOR`:` the default translator (same options as the --translator cli argument)
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `MISTRAL_API_KEY`
