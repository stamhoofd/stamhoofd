import { BaseColumnMatcher, ColumnMatcher } from './ColumnMatcher';

export class MatchedColumn {
    index = 0;
    selected = false;
    name: string;
    examples: string[] = [];
    matcher: ColumnMatcher | null = null;

    // For vue bug only...
    matchersReference: ColumnMatcher[];

    constructor(index: number, name: string, matchersReference: ColumnMatcher[]) {
        this.index = index;
        this.name = name;
        this.matchersReference = matchersReference;
    }

    /// Fallback for vue bug that is not able to detect the proper selected matcher -.-
    get matcherName() {
        return this.matcher?.getName() ?? null;
    }

    /// Fallback for vue bug that is not able to detect the proper selected matcher -.-
    get matcherCode() {
        return this.matcher?.id ?? null;
    }

    get isBaseMatcher(): boolean {
        return this.matcher !== null && isBaseMatcher(this.matcher);
    }

    get baseMatcher(): BaseColumnMatcher | null {
        if (this.matcher !== null && isBaseMatcher(this.matcher)) {
            return this.matcher;
        }

        return null;
    }

    /// Fallback for vue bug that is not able to detect the proper selected matcher -.-
    set matcherCode(name: string | null) {
        if (name === null) {
            this.matcher = null;
            return;
        }

        for (const matcher of this.matchersReference) {
            if (matcher.id === name) {
                this.matcher = matcher;
                return;
            }
        }
        this.matcher = null;
    }
}

function isBaseMatcher(matcher: ColumnMatcher): matcher is BaseColumnMatcher {
    return matcher['setBaseValue'] !== undefined;
}
