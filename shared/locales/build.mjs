// Loop all locales
import { promises as fs } from "fs";
import { countries, languages } from "./dist/index.js";

async function fileExists(file) {
    try {
        await fs.access(file, fs.constants.F_OK);
        return true;
    } catch (e) {
        // ignore
    }
    return false;
}

const namespaces = ["stamhoofd", "digit"]

for (const namespace of namespaces) {
    await fs.rm("./dist/"+namespace, { recursive: true, force: true })
    await fs.rm("./esm/dist/"+namespace, { recursive: true, force: true })
    await fs.mkdir("./dist/"+namespace, { recursive: true })
    await fs.mkdir("./esm/dist/"+namespace, { recursive: true })
}

function mergeObjects(into, from) {
    if (
        typeof into !== 'object' ||
        Array.isArray(into) ||
        into === null
    ) {
        if (from === "" && typeof into === "string") {
            // Do not override empty values
            return into
        }
        // Override full variable
        return from
    }

    if (
        typeof from !== 'object' ||
        Array.isArray(from) ||
        from === null
    ) {
        // Override full variable

        console.warn("Type mismatch in merge operation", into, from)
        return from
    }

    for (const key in from) {
        if (!Object.prototype.hasOwnProperty.call(from, key)) {
            // Not own property
            continue
        }

        if (Object.prototype.hasOwnProperty.call(into, key)) {
            // Merge again
            into[key] = mergeObjects(into[key], from[key])
        } else {
            into[key] = from[key]
        }
    }

    return into
}


function replaceValues(object, callback) {
    for (const key in object) {
        if (!Object.prototype.hasOwnProperty.call(object, key)) {
            // Not own property
            continue
        }

        if (typeof object[key] === "object") {
            replaceValues(object[key], callback)
        } else {
            object[key] = callback(object[key])
        }
    }
}

// Step 1: build full list of all available keys with default values

// Make sure English is loaded as last, because this should contain the default values for untranslated properties
const enIndex = languages.findIndex((n) => n === "en")
if (enIndex != -1) {
    languages.splice(enIndex, 1)
    languages.push("en")
}

const fallbackLanguages = ['en', 'nl']

let defaultKeys = JSON.parse(await fs.readFile("./src/base.json"))

function runReplacements(json) {
    const replacements = json.replacements
    if (replacements) {
        replaceValues(json, (value) => {
            if (typeof value !== 'string') {
                return value;
            }
            for (const r of Object.keys(replacements)) {
                value = value.replaceAll(r, replacements[r])
            }

            return value
        })
    }
    delete json.replacements
}

for (const country of countries) {
    // Build country defatuls
    for (const language of languages) {
        const locale = language+"-"+country

        for (const namespace of namespaces) {
            // global base
            let json = JSON.parse(JSON.stringify(defaultKeys))

            // Fallbacks
            for (const fallbackLanguage of fallbackLanguages) {
                if (fallbackLanguage === language) {
                    continue;
                }
                const fallbackLocale = fallbackLanguage+"-"+country

                // Namespace base
                if (await fileExists("./src/" + namespace + '/base.json')) {
                    const specifics = JSON.parse(await fs.readFile("./src/" + namespace + '/base.json'))
                    json = mergeObjects(json, specifics)
                }

                // Language
                if (await fileExists("./src/" + fallbackLanguage + ".json")) {
                    const specifics = JSON.parse(await fs.readFile("./src/" + fallbackLanguage + ".json"))
                    json = mergeObjects(json, specifics)
                }

                // Namespace language
                if (await fileExists("./src/" + namespace + '/' + fallbackLanguage + ".json")) {
                    const specifics = JSON.parse(await fs.readFile("./src/" + namespace + '/' + fallbackLanguage + ".json"))
                    json = mergeObjects(json, specifics)
                }

                // Locale
                if (await fileExists("./src/" + fallbackLocale + ".json")) {
                    const specifics = JSON.parse(await fs.readFile("./src/" + fallbackLocale + ".json"))
                    json = mergeObjects(json, specifics)
                }

                // Namespace locale
                if (await fileExists("./src/" + namespace + '/' + fallbackLocale + ".json")) {
                    const specifics = JSON.parse(await fs.readFile("./src/" + namespace + '/' + fallbackLocale + ".json"))
                    json = mergeObjects(json, specifics)
                }

                // Run replacements in local context
                runReplacements(json)
            }

            // Namespace base
            if (await fileExists("./src/" + namespace + '/base.json')) {
                const specifics = JSON.parse(await fs.readFile("./src/" + namespace + '/base.json'))
                json = mergeObjects(json, specifics)
            }

            // Language
            if (await fileExists("./src/" + language + ".json")) {
                const specifics = JSON.parse(await fs.readFile("./src/" + language + ".json"))
                json = mergeObjects(json, specifics)
            }

            // Namespace language
            if (await fileExists("./src/" + namespace + '/' + language + ".json")) {
                const specifics = JSON.parse(await fs.readFile("./src/" + namespace + '/' + language + ".json"))
                json = mergeObjects(json, specifics)
            }

            // Locale
            if (await fileExists("./src/" + locale + ".json")) {
                const specifics = JSON.parse(await fs.readFile("./src/" + locale + ".json"))
                json = mergeObjects(json, specifics)
            }

            // Namespace locale
            if (await fileExists("./src/" + namespace + '/' + locale + ".json")) {
                const specifics = JSON.parse(await fs.readFile("./src/" + namespace + '/' + locale + ".json"))
                json = mergeObjects(json, specifics)
            }

            runReplacements(json)
            fs.writeFile("./dist/"+namespace+"/"+locale+".json", JSON.stringify(json));
            fs.writeFile("./esm/dist/"+namespace+"/"+locale+".json", JSON.stringify(json));
        }
    }
}
