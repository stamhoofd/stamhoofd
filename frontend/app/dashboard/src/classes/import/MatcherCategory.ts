export enum MatcherCategory {
    Member = "Lid",
    Payment = "Betaling",
    Parent1 = "Ouder 1",
    Parent2 = "Ouder 2"
}

export class MatcherCategoryHelper {
    static getName(category: MatcherCategory) {
        switch(category) {
            case MatcherCategory.Member: return "Lid"
            case MatcherCategory.Payment: return "Betaling"
            case MatcherCategory.Parent1: return "Ouder 1"
            case MatcherCategory.Parent2: return "Ouder 2"
            default: {
                const t: never = category
                throw new Error("Unknown category " + t)
            }
        }
    }
}