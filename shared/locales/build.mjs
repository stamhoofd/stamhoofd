// Loop all locales
import { promises as fs } from "fs";
import { countries, languages } from "./dist/index.js";

const files = await fs.readdir("./src");


const namespaces = ['dashboard', "webshop", "registration", "backend"]

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

for (const country of countries) {
    for (const language of languages) {
        const locale = language+"-"+country
        console.log(locale)

        if (!files.includes(language+".json")) {
            throw new Error("Language "+language+" has not been defined. Please add "+language+".json first.")
        }

        let json = JSON.parse(await fs.readFile("./src/"+language+".json"))

        if (files.includes(locale+".json")) {
            const specifics = JSON.parse(await fs.readFile("./src/"+locale+".json"))
            json = mergeObjects(json, specifics)
        }

        for (const namespace of namespaces) {
            fs.writeFile("./dist/"+namespace+"/"+locale+".json", JSON.stringify(
                {
                    shared: json.shared,
                    [namespace]: json[namespace]
                }
            ))

            fs.writeFile("./esm/dist/"+namespace+"/"+locale+".json", JSON.stringify(
                {
                    shared: json.shared,
                    [namespace]: json[namespace]
                }
            ))
        }
    }
}