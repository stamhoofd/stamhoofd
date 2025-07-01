import { Group } from '@stamhoofd/structures';
import { AddressColumnMatcher } from './AddressColumnMatcher';
import { ColumnMatcherHelper } from './ColumnMatcherHelper';
import { DateColumnMatcher } from './DateColumnMatcher';
import { BirthDayColumnMatcher } from './default-matchers/BirthDayColumnMatcher';
import { CityColumnMatcher } from './default-matchers/CityColumnMatcher';
import { CityWithZipColumnMatcher } from './default-matchers/CityWithZipColumnMatcher';
import { EmailColumnMatcher } from './default-matchers/EmailColumnMatcher';
import { FirstNameColumnMatcher } from './default-matchers/FirstNameColumnMatcher';
import { FullNameColumnMatcher } from './default-matchers/FullNameColumnMatcher';
import { GenderColumnMatcher } from './default-matchers/GenderColumnMatcher';
import { GroupColumnMatcher } from './default-matchers/GroupColumnMatcher';
import { LastNameColumnMatcher } from './default-matchers/LastNameColumnMatcher';
import { MemberNumberColumnMatcher } from './default-matchers/MemberNumberColumnMatcher';
import { PaidColumnMatcher } from './default-matchers/PaidColumnMatcher';
import { PaidPriceColumnMatcher } from './default-matchers/PaidPriceColumnMatcher';
import { PaymentPriceColumnMatcher } from './default-matchers/PaymentPriceColumnMatcher';
import { PhoneColumnMatcher } from './default-matchers/PhoneColumnMatcher';
import { StreetColumnMatcher } from './default-matchers/StreetColumnMatcher';
import { StreetNumberColumnMatcher } from './default-matchers/StreetNumberColumnMatcher';
import { StreetWithNumberColumnMatcher } from './default-matchers/StreetWithNumberColumnMatcher';
import { ZipColumnMatcher } from './default-matchers/ZipColumnMatcher';
import { MemberDetailsMatcherCategory } from './MemberDetailsMatcherCategory';

// Always make sure fullname is before lastname!
export const getMemberMatchers = (groups: Group[]) => [
    new MemberNumberColumnMatcher(),
    new FullNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new FirstNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new LastNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new BirthDayColumnMatcher(),
    new GenderColumnMatcher(),
    new GroupColumnMatcher(groups),
    new PhoneColumnMatcher(MemberDetailsMatcherCategory.Member),
    new EmailColumnMatcher(MemberDetailsMatcherCategory.Member),
    new StreetWithNumberColumnMatcher(MemberDetailsMatcherCategory.Member),
    new StreetColumnMatcher(MemberDetailsMatcherCategory.Member),
    new StreetNumberColumnMatcher(MemberDetailsMatcherCategory.Member),
    new CityColumnMatcher(MemberDetailsMatcherCategory.Member),
    new ZipColumnMatcher(MemberDetailsMatcherCategory.Member),
    new CityWithZipColumnMatcher(MemberDetailsMatcherCategory.Member),
    new AddressColumnMatcher({
        name: 'Adres lid (volledig)',
        category: MemberDetailsMatcherCategory.Member,
        required: false,
        possibleMatch: ['Adres lid'],
        negativeMatch: ['ouder', 'parent', 'contact'],
        get: importResult => importResult.patchedDetails.address ?? undefined,
        save: (address, importResult) => {
            ColumnMatcherHelper.patchAddress(importResult, MemberDetailsMatcherCategory.Member, address);
        },
    }),
    new DateColumnMatcher({
        name: 'Datum van inschrijving',
        category: MemberDetailsMatcherCategory.Member,
        required: false,
        possibleMatch: ['datum', 'date'],
        negativeMatch: ['geboortedatum', 'verjaardag', 'birth day'],
        get: importResult => importResult.registration.date ?? undefined,
        save: (d, importResult) => {
            importResult.registration.date = d;
        },
    }),
];

export const parentMatchers1 = [
    new FullNameColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new FirstNameColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new LastNameColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new PhoneColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new EmailColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new StreetWithNumberColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new StreetColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new StreetNumberColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new CityColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new ZipColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new AddressColumnMatcher({
        name: 'Adres ouder 1 (volledig)',
        category: MemberDetailsMatcherCategory.Parent1,
        required: false,
        possibleMatch: ['Adres ouder', 'Adres'],
        negativeMatch: ['ouder 2'],
        get: importResult => ColumnMatcherHelper.getAddress(importResult, MemberDetailsMatcherCategory.Parent1) ?? undefined,
        save: (address, importResult) => {
            ColumnMatcherHelper.patchAddress(importResult, MemberDetailsMatcherCategory.Parent1, address);
        },
    }),
    new CityWithZipColumnMatcher(MemberDetailsMatcherCategory.Parent1),
];

export const parentMatchers2 = [
    new FullNameColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new FirstNameColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new LastNameColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new PhoneColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new EmailColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new StreetWithNumberColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new StreetColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new StreetNumberColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new CityColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new ZipColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new AddressColumnMatcher({
        name: 'Adres ouder 2 (volledig)',
        category: MemberDetailsMatcherCategory.Parent2,
        required: false,
        possibleMatch: ['Adres ouder 2'],
        get: importResult => ColumnMatcherHelper.getAddress(importResult, MemberDetailsMatcherCategory.Parent2) ?? undefined,
        save: (address, importResult) => {
            ColumnMatcherHelper.patchAddress(importResult, MemberDetailsMatcherCategory.Parent2, address);
        },
    }),
    new CityWithZipColumnMatcher(MemberDetailsMatcherCategory.Parent2),
];

export const paymentMatchers = [
    new PaidColumnMatcher(),
    new PaidPriceColumnMatcher(),
    new PaymentPriceColumnMatcher(),
];

export const getAllMatchers = (groups: Group[]) => [
    ...getMemberMatchers(groups),
    ...paymentMatchers,
    ...parentMatchers1,
    ...parentMatchers2,
];
