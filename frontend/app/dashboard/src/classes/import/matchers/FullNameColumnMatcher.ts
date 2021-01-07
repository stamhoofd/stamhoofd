import { ColumnMatcher } from "../ColumnMatcher";

class FullNameColumnMatcherClass implements ColumnMatcher {
    id = "FullNameColumnMatcher"

    getName(): string {
        return "Volledige naam"
    }

    getCategory(): string {
        return "Van lid zelf"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()
        const negativeMatch = ["ouder", "parent", "vader", "moeder", "mama", "papa", "voogd", "contact", "voornaam", "achternaam", "familienaam", "firstname", "lastname"]

        for (const word of negativeMatch) {
            if (cleaned.includes(word)) {
                return false
            }
        }
        

        if (["volledige naam"].includes(cleaned)) {
            return true
        }

        const possibleMatch = ["naam", "name"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.doExamplesHaveFullNames(examples)
            }
        }
        return false
    }

    doExamplesHaveFullNames(examples: string[]): boolean {
        if (examples.length == 0) {
            return false
        }
        for (const example of examples) {
            if (!example.match(/\w\s+\w/g)) {
                return false
            }
        }
        return true
    }

}

export const FullNameColumnMatcher = new FullNameColumnMatcherClass()