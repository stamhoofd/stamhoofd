
import { Parent, ParentType } from "@stamhoofd/structures";

import { BirthDayColumnMatcher } from "./default-matchers/BirthDayColumnMatcher";
import { CityColumnMatcher } from "./default-matchers/CityColumnMatcher";
import { CityWithZipColumnMatcher } from "./default-matchers/CityWithZipColumnMatcher";
import { EmailColumnMatcher } from "./default-matchers/EmailColumnMatcher";
import { FirstNameColumnMatcher } from "./default-matchers/FirstNameColumnMatcher";
import { FullNameColumnMatcher } from "./default-matchers/FullNameColumnMatcher";
import { GenderColumnMatcher } from "./default-matchers/GenderColumnMatcher";
import { GroupColumnMatcher } from "./default-matchers/GroupColumnMatcher";
import { LastNameColumnMatcher } from "./default-matchers/LastNameColumnMatcher";
import { MemberNumberColumnMatcher } from "./default-matchers/MemberNumberColumnMatcher";
import { PaidColumnMatcher } from "./default-matchers/PaidColumnMatcher";
import { PaidPriceColumnMatcher } from "./default-matchers/PaidPriceColumnMatcher";
import { PaymentPriceColumnMatcher } from "./default-matchers/PaymentPriceColumnMatcher";
import { PhoneColumnMatcher } from "./default-matchers/PhoneColumnMatcher";
import { RegisterDateColumnMatcher } from "./default-matchers/RegisterDateColumnMatcher";
import { StreetColumnMatcher } from "./default-matchers/StreetColumnMatcher";
import { StreetNumberColumnMatcher } from "./default-matchers/StreetNumberColumnMatcher";
import { StreetWithNumberColumnMatcher } from "./default-matchers/StreetWithNumberColumnMatcher";
import { ZipColumnMatcher } from "./default-matchers/ZipColumnMatcher";
import { MatcherCategory } from "./MatcherCategory";
import { AddressColumnMatcher } from "./matchers";

// Always make sure fullname is before lastname!
export const memberMatchers = [
    new MemberNumberColumnMatcher(),
    new FullNameColumnMatcher(MatcherCategory.Member),
    new FirstNameColumnMatcher(MatcherCategory.Member),
    new LastNameColumnMatcher(MatcherCategory.Member),
    new BirthDayColumnMatcher(),
    new GenderColumnMatcher(),
    new GroupColumnMatcher(),
    new PhoneColumnMatcher(MatcherCategory.Member),
    new EmailColumnMatcher(MatcherCategory.Member),
    new StreetWithNumberColumnMatcher(MatcherCategory.Member),
    new StreetColumnMatcher(MatcherCategory.Member),
    new StreetNumberColumnMatcher(MatcherCategory.Member),
    new CityColumnMatcher(MatcherCategory.Member),
    new ZipColumnMatcher(MatcherCategory.Member),
    new CityWithZipColumnMatcher(MatcherCategory.Member),
    new AddressColumnMatcher({
        name: 'Adres lid (volledig)',
        category: MatcherCategory.Member,
        required: false,
        possibleMatch: ['Adres lid'],
        negativeMatch: ['ouder', 'parent', 'contact'],
        get: (member) => member.details.address ?? undefined,
        save: (address, member) => {
            member.details.address = address
        }
    }),
    new RegisterDateColumnMatcher(),
]

export const parentMatchers1 = [
    new FullNameColumnMatcher(MatcherCategory.Parent1),
    new FirstNameColumnMatcher(MatcherCategory.Parent1),
    new LastNameColumnMatcher(MatcherCategory.Parent1),
    new PhoneColumnMatcher(MatcherCategory.Parent1),
    new EmailColumnMatcher(MatcherCategory.Parent1),
    new StreetWithNumberColumnMatcher(MatcherCategory.Parent1),
    new StreetColumnMatcher(MatcherCategory.Parent1),
    new StreetNumberColumnMatcher(MatcherCategory.Parent1),
    new CityColumnMatcher(MatcherCategory.Parent1),
    new ZipColumnMatcher(MatcherCategory.Parent1),
    new AddressColumnMatcher({
        name: 'Adres ouder 1 (volledig)',
        category: MatcherCategory.Parent1,
        required: false,
        possibleMatch: ['Adres ouder', 'Adres'],
        negativeMatch: ['ouder 2'],
        get: (member) => member.details.parents[0]?.address ?? undefined,
        save: (address, member) => {
            if (member.details.parents.length == 0) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent1
                }))
            }
            member.details.parents[0].address = address
        }
    }),
    new CityWithZipColumnMatcher(MatcherCategory.Parent1)
]


export const parentMatchers2 = [
    new FullNameColumnMatcher(MatcherCategory.Parent2),
    new FirstNameColumnMatcher(MatcherCategory.Parent2),
    new LastNameColumnMatcher(MatcherCategory.Parent2),
    new PhoneColumnMatcher(MatcherCategory.Parent2),
    new EmailColumnMatcher(MatcherCategory.Parent2),
    new StreetWithNumberColumnMatcher(MatcherCategory.Parent2),
    new StreetColumnMatcher(MatcherCategory.Parent2),
    new StreetNumberColumnMatcher(MatcherCategory.Parent2),
    new CityColumnMatcher(MatcherCategory.Parent2),
    new ZipColumnMatcher(MatcherCategory.Parent2),
    new AddressColumnMatcher({
        name: 'Adres ouder 2 (volledig)',
        category: MatcherCategory.Parent2,
        required: false,
        possibleMatch: ['Adres ouder 2'],
        get: (member) => member.details.parents[1]?.address ?? undefined,
        save: (address, member) => {
            if (member.details.parents.length < 2) {
                member.details.parents.push(Parent.create({
                    type: member.details.parents.length == 0 ? ParentType.Parent1 : ParentType.Parent2
                }))
            }
            if (member.details.parents.length < 2) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent2
                }))
            }
            member.details.parents[1].address = address
        }
    }),
    new CityWithZipColumnMatcher(MatcherCategory.Parent2)
]

export const paymentMatchers = [
    new PaidColumnMatcher(),
    new PaidPriceColumnMatcher(),
    new PaymentPriceColumnMatcher()
]

export const allMatchers = [
    ...memberMatchers,
    ...paymentMatchers,
    ...parentMatchers1,
    ...parentMatchers2
]
