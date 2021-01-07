import { ColumnMatcher } from "../ColumnMatcher";

class LastNameColumnMatcherClass implements ColumnMatcher {
    id = "LastNameColumnMatcher"

    getName(): string {
        return "Achternaam"
    }

    getCategory(): string {
        return "Van lid zelf"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()
        const negativeMatch = ["ouder", "parent", "vader", "moeder", "mama", "papa", "voogd", "contact", "voornaam", "firstname"]

        for (const word of negativeMatch) {
            if (cleaned.includes(word)) {
                return false
            }
        }
        
        const possibleMatch = ["naam", "name", "achternaam", "lastname", "familienaam"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }
}

export const LastNameColumnMatcher = new LastNameColumnMatcherClass()