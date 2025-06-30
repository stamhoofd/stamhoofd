import { ColumnMatcher } from './ColumnMatcher';
import { DateColumnMatcher } from './DateColumnMatcher';
import { FirstNameColumnMatcher } from './default-matchers/FirstNameColumnMatcher';
import { FullNameColumnMatcher } from './default-matchers/FullNameColumnMatcher';
import { LastNameColumnMatcher } from './default-matchers/LastNameColumnMatcher';
import { ImportMemberAccumulatedResult } from './ImportMemberAccumulatedResult';
import { MemberDetailsMatcherCategory } from './MemberDetailsMatcherCategory';

export const allMatchers: ColumnMatcher<ImportMemberAccumulatedResult>[] = [
    new FullNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new FirstNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new LastNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new DateColumnMatcher({
        name: 'Geboortedatum',
        category: MemberDetailsMatcherCategory.Member,
        required: false,
        possibleMatch: ['geboortedatum', 'verjaardag', 'birth day'],
        get: member => member.birthDay ?? undefined,
        save: (d, member) => {
            member.birthDay = d;
        },
    }),
];
