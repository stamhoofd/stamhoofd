import { ColumnMatcher } from "../ColumnMatcher";

class FirstNameColumnMatcherClass implements ColumnMatcher {
    id = "FirstNameColumnMatcher"

    getName(): string {
        return "Voornaam"
    }

    getCategory(): string {
        return "Van lid zelf"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()
        const negativeMatch = ["ouder", "parent", "vader", "moeder", "mama", "papa", "voogd", "contact", "achternaam", "familienaam", "lastname"]

        for (const word of negativeMatch) {
            if (cleaned.includes(word)) {
                return false
            }
        }
        
        const possibleMatch = ["voornaam", "firstname"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }
}

export const FirstNameColumnMatcher = new FirstNameColumnMatcherClass()