// Loop all locales
import { promises as fs } from 'fs';
import { countries, languages } from './dist/index.js';

async function fileExists(file) {
    try {
        await fs.access(file, fs.constants.F_OK);
        return true;
    }
    catch (e) {
        // ignore
    }
    return false;
}

const translatorType = 'MistralSmall';
const namespaces = ['stamhoofd', 'digit', 'keeo', 'jamboree'];

for (const namespace of namespaces) {
    // await fs.rm("./dist/"+namespace, { recursive: true, force: true })
    // await fs.rm("./esm/dist/"+namespace, { recursive: true, force: true })
    await fs.mkdir('./dist/' + namespace, { recursive: true });
    await fs.mkdir('./esm/dist/' + namespace, { recursive: true });
}

function mergeObjects(into, from, missingOnly = false) {
    if (
        typeof into !== 'object'
        || Array.isArray(into)
        || into === null
    ) {
        if (from === '' && typeof into === 'string') {
            // Do not override empty values
            return into;
        }

        if (typeof into === 'string' && into.length > 0 && missingOnly) {
            // Do not override
            return into;
        }

        // Override full variable
        return from;
    }

    if (
        typeof from !== 'object'
        || Array.isArray(from)
        || from === null
    ) {
        // Override full variable

        console.warn('Type mismatch in merge operation', into, from);
        return from;
    }

    for (const key in from) {
        if (!Object.prototype.hasOwnProperty.call(from, key)) {
            // Not own property
            continue;
        }

        if (Object.prototype.hasOwnProperty.call(into, key)) {
            // Merge again
            into[key] = mergeObjects(into[key], from[key], missingOnly);
        }
        else {
            into[key] = from[key];
        }
    }

    return into;
}

function replaceValues(object, callback) {
    for (const key in object) {
        if (!Object.prototype.hasOwnProperty.call(object, key)) {
            // Not own property
            continue;
        }

        if (typeof object[key] === 'object') {
            replaceValues(object[key], callback);
        }
        else {
            object[key] = callback(object[key]);
        }
    }
}

// Step 1: build full list of all available keys with default values

// Make sure English is loaded as last, because this should contain the default values for untranslated properties
const enIndex = languages.findIndex(n => n === 'en');
if (enIndex !== -1) {
    languages.splice(enIndex, 1);
    languages.push('en');
}

const fallbackLanguages = ['en', 'nl'];

function runReplacements(json) {
    const replacements = json.replacements;
    if (replacements) {
        replaceValues(json, (value) => {
            if (typeof value !== 'string') {
                return value;
            }
            for (const r of Object.keys(replacements)) {
                value = value.replaceAll(new RegExp(`${r}+(?![^{]*})`, 'g'), replacements[r]);
            }

            return value;
        });
    }
    delete json.replacements;
}

async function build(country, language, namespace, skipFallbackLanguages, skipNamespaces, skipReplace) {
    const locale = language + '-' + country;
    let json = {};

    if (namespace) {
        if (skipNamespaces && skipNamespaces.includes(namespace)) {
            throw new Error('Circular dependency detected: ' + skipNamespaces.join(' -> ') + ' -> ' + namespace);
        }
        // Start with inheriting from the non namespaced version
        json = mergeObjects(json,
            await build(
                country,
                language,
                null,
                skipFallbackLanguages,
                [...skipNamespaces || [], namespace],
                true, // do not replace translations from the default namespace
            ),
        );
    }

    let folder = namespace ? './src/' + namespace : './src';

    // base
    if (await fileExists(folder + '/base.json')) {
        const specifics = JSON.parse(await fs.readFile(folder + '/base.json'));
        if ('extends' in specifics) {
            if (!Array.isArray(specifics.extends)) {
                throw new Error('Invalid extends in ' + folder + '/base.json');
            }
            for (const extend of specifics.extends) {
                const extendJson = await build(
                    country,
                    language,
                    extend,
                    skipFallbackLanguages, [...skipNamespaces || [], namespace],
                    true, // do not replace translations from the extended namespaces
                );
                json = mergeObjects(json, extendJson);
            }
        }
        json = mergeObjects(json, specifics);
    }

    // machine translations of language file
    const machineLanguageFile = `${folder}/machine-${translatorType}-${language}.json`;
    if (await fileExists(machineLanguageFile)) {
        const specifics = await readMachineTranslations(machineLanguageFile);
        json = mergeObjects(json, specifics);
    }

    // language
    if (await fileExists(folder + '/' + language + '.json')) {
        const specifics = JSON.parse(await fs.readFile(folder + '/' + language + '.json'));
        json = mergeObjects(json, specifics);
    }

    // machine translations of locale file
    const machineLocaleFile = `${folder}/machine-${translatorType}-${locale}.json`;
    if (await fileExists(machineLocaleFile)) {
        const specifics = await readMachineTranslations(machineLocaleFile);
        json = mergeObjects(json, specifics);
    }

    // locale
    if (await fileExists(folder + '/' + locale + '.json')) {
        const specifics = JSON.parse(await fs.readFile(folder + '/' + locale + '.json'));
        json = mergeObjects(json, specifics);
    }

    if (!skipReplace) {
        runReplacements(json);
    }

    // If we still have missing translations, fall back to the fallback languages, by only setting missing values
    if (!skipFallbackLanguages) {
        for (const fallbackLanguage of [...fallbackLanguages].reverse()) {
            if (fallbackLanguage === language) {
                continue;
            }

            json = mergeObjects(
                json,
                await build(country, fallbackLanguage, namespace, true, skipNamespaces, skipReplace),
                true, // missing only
            );
        }
    }

    return json;
}

for (const country of countries) {
    // Build country defaults
    for (const language of languages) {
        const locale = language + '-' + country;

        for (const namespace of namespaces) {
            const json = await build(country, language, namespace);
            const data = JSON.stringify(json);

            try {
                const existingData = await fs.readFile('./dist/' + namespace + '/' + locale + '.json', { encoding: 'utf8' });
                const existingDataEsm = await fs.readFile('./esm/dist/' + namespace + '/' + locale + '.json', { encoding: 'utf8' });

                if (existingData !== data || existingDataEsm !== data) {
                    console.log(namespace + '/' + locale + ' has changed');
                    await fs.writeFile('./dist/' + namespace + '/' + locale + '.json', data);
                    await fs.writeFile('./esm/dist/' + namespace + '/' + locale + '.json', data);
                }
            }
            catch (e) {
                await fs.writeFile('./dist/' + namespace + '/' + locale + '.json', data);
                await fs.writeFile('./esm/dist/' + namespace + '/' + locale + '.json', data);
            }
        }
    }
}

async function readMachineTranslations(machineLanguageFile) {
    const dictonary = JSON.parse(await fs.readFile(machineLanguageFile));
    return Object.fromEntries(
        Object.entries(
            dictonary,
        ).map(([key, value]) => {
            return [key, value.translation];
        }),
    );
}
