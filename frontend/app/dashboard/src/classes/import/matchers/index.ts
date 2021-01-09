import { MatcherCategory } from "../MatcherCategory";
import { BirthDayColumnMatcher } from "./BirthDayColumnMatcher";
import { FirstNameColumnMatcher } from "./FirstNameColumnMatcher";
import { FullNameColumnMatcher } from "./FullNameColumnMatcher";
import { GenderColumnMatcher } from "./GenderColumnMatcher";
import { GroupColumnMatcher } from "./GroupColumnMatcher";
import { LastNameColumnMatcher } from "./LastNameColumnMatcher";

// Always make sure fullname is before lastname!
export const memberMatchers = [
    new FullNameColumnMatcher(MatcherCategory.Member),
    new FirstNameColumnMatcher(MatcherCategory.Member),
    new LastNameColumnMatcher(MatcherCategory.Member),
    new BirthDayColumnMatcher(),
    new GenderColumnMatcher(),
    new GroupColumnMatcher(),
]

export const parentMatchers1 = [
    new FullNameColumnMatcher(MatcherCategory.Parent1),
    new FirstNameColumnMatcher(MatcherCategory.Parent1),
    new LastNameColumnMatcher(MatcherCategory.Parent1),
]


export const parentMatchers2 = [
    new FullNameColumnMatcher(MatcherCategory.Parent2),
    new FirstNameColumnMatcher(MatcherCategory.Parent2),
    new LastNameColumnMatcher(MatcherCategory.Parent2),
]


export const allMathcers = [
    ...memberMatchers,
    ...parentMatchers1,
    ...parentMatchers2
]
