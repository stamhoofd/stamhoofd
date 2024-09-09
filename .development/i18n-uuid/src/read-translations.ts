import fs from "fs";

export function readTranslations(filePath: string): Record<string, string> {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
