import { MatcherCategory } from "./MatcherCategory"

/// Logic that is shared between matchers for members and parents
export class SharedMatcher {
    category: MatcherCategory
    protected negativeMatch: string[] = []

    constructor(category: MatcherCategory) {
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
}