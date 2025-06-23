import { MemberDetails } from '@stamhoofd/structures';
import { ColumnMatcher } from './ColumnMatcher';
import { DateColumnMatcher } from './DateColumnMatcher';
import { FirstNameColumnMatcher } from './default-matchers/FirstNameColumnMatcher';
import { LastNameColumnMatcher } from './default-matchers/LastNameColumnMatcher';
import { MemberDetailsMatcherCategory } from './MemberDetailsMatcherCategory';

export const allMatchers: ColumnMatcher<MemberDetails>[] = [
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
