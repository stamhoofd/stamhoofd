import { MatcherCategory } from "./MatcherCategory"

/// Logic that is shared between matchers for members and parents
export class SharedMatcher {
    category: string
    protected negativeMatch: string[] = []
    protected possibleMatch: string[] = []

    constructor(category: string) {
        this.category = category

        if (category == MatcherCategory.Member) {
            this.negativeMatch = ["ouder", "parent", "vader", "moeder", "mama", "papa", "voogd", "contact"]
        }
        if (category == MatcherCategory.Parent1) {
            this.negativeMatch = ["lid", "member", "2", "tweede"]
        }
        if (category == MatcherCategory.Parent2) {
            this.negativeMatch = ["lid", "member", "1", "eerste"]
        }
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        for (const word of this.negativeMatch) {
            if (cleaned.includes(word)) {
                return false
            }
        }
        
        for (const word of this.possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }
}