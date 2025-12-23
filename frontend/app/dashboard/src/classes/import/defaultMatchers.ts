import { SimpleError } from '@simonbackx/simple-errors';
import { Address, Group, Organization, OrganizationRegistrationPeriod, Platform, RecordCategory, RecordType } from '@stamhoofd/structures';
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
import { NationalRegisterNumberColumnMatcher } from './default-matchers/NationalRegisterNumberMatcher';
import { PaidColumnMatcher } from './default-matchers/PaidColumnMatcher';
import { PaidPriceColumnMatcher } from './default-matchers/PaidPriceColumnMatcher';
import { PaymentPriceColumnMatcher } from './default-matchers/PaymentPriceColumnMatcher';
import { PhoneColumnMatcher } from './default-matchers/PhoneColumnMatcher';
import { SecurityCodeColumnMatcher } from './default-matchers/SecurityCodeColumnMatcher';
import { StreetColumnMatcher } from './default-matchers/StreetColumnMatcher';
import { StreetNumberColumnMatcher } from './default-matchers/StreetNumberColumnMatcher';
import { StreetWithNumberColumnMatcher } from './default-matchers/StreetWithNumberColumnMatcher';
import { UitpasNumberColumnMatcher } from './default-matchers/UitpasNumberColumnMatcher';
import { ZipColumnMatcher } from './default-matchers/ZipColumnMatcher';
import { ImportMemberResult } from './ImportMemberResult';
import { MemberDetailsMatcherCategory } from './MemberDetailsMatcherCategory';
import { TextColumnMatcher } from './TextColumnMatcher';

// Always make sure fullname is before lastname!
export const getMemberMatchers = (getGroups: () => Group[], getPeriod: () => OrganizationRegistrationPeriod) => [
    new MemberNumberColumnMatcher(),
    new FullNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new FirstNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new LastNameColumnMatcher(MemberDetailsMatcherCategory.Member),
    new BirthDayColumnMatcher(),
    new GenderColumnMatcher(),
    new GroupColumnMatcher(getGroups),
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
        save: (address, importResult: ImportMemberResult) => {
            ColumnMatcherHelper.patchAddress(importResult, MemberDetailsMatcherCategory.Member, address);
        },
    }),
    new DateColumnMatcher({
        name: 'Startdatum van inschrijving',
        category: MemberDetailsMatcherCategory.Member,
        required: false,
        possibleMatch: ['datum', 'date'],
        negativeMatch: ['geboortedatum', 'verjaardag', 'birth day', 'einddatum', 'end date'],
        get: (importResult: ImportMemberResult) => importResult.importRegistrationResult.startDate ?? undefined,
        save: (d, importResult: ImportMemberResult) => {
            const period = getPeriod();

            if (d < period.period.startDate || d > period.period.endDate) {
                throw new SimpleError({
                    code: 'invalid_start_date',
                    message: $t('dbcf7fbb-376c-4712-a854-1781ca8f6c82'),
                });
            }

            importResult.importRegistrationResult.startDate = d;
        },
    }),
    new DateColumnMatcher({
        name: 'Einddatum van inschrijving',
        category: MemberDetailsMatcherCategory.Member,
        required: false,
        possibleMatch: ['einddatum', 'end date'],
        negativeMatch: ['geboortedatum', 'verjaardag', 'birth day', 'startdatum', 'start date', 'startdatum'],
        get: (importResult: ImportMemberResult) => importResult.importRegistrationResult.endDate ?? undefined,
        save: (d, importResult: ImportMemberResult) => {
            const period = getPeriod();

            if (d < period.period.startDate || d > period.period.endDate) {
                throw new SimpleError({
                    code: 'invalid_end_date',
                    message: $t('De einddatum van de inschrijving ligt buiten het geselecteerde werkjaar.'),
                });
            }

            importResult.importRegistrationResult.endDate = d;
        },
    }),
    new UitpasNumberColumnMatcher(),
    new NationalRegisterNumberColumnMatcher(MemberDetailsMatcherCategory.Member),
    new SecurityCodeColumnMatcher(),
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
        get: (importResult: ImportMemberResult) => ColumnMatcherHelper.getAddress(importResult, MemberDetailsMatcherCategory.Parent1) ?? undefined,
        save: (address, importResult: ImportMemberResult) => {
            ColumnMatcherHelper.patchAddress(importResult, MemberDetailsMatcherCategory.Parent1, address);
        },
    }),
    new CityWithZipColumnMatcher(MemberDetailsMatcherCategory.Parent1),
    new NationalRegisterNumberColumnMatcher(MemberDetailsMatcherCategory.Parent1),
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
        get: (importResult: ImportMemberResult) => ColumnMatcherHelper.getAddress(importResult, MemberDetailsMatcherCategory.Parent2) ?? undefined,
        save: (address, importResult: ImportMemberResult) => {
            ColumnMatcherHelper.patchAddress(importResult, MemberDetailsMatcherCategory.Parent2, address);
        },
    }),
    new CityWithZipColumnMatcher(MemberDetailsMatcherCategory.Parent2),
    new NationalRegisterNumberColumnMatcher(MemberDetailsMatcherCategory.Parent2),
];

export const paymentMatchers = [
    new PaidColumnMatcher(),
    new PaidPriceColumnMatcher(),
    new PaymentPriceColumnMatcher(),
];

export const getAllMatchers = (platform: Platform, organization: Organization, getGroups: () => Group[], getPeriod: () => OrganizationRegistrationPeriod) => {
    const matchers = [
        ...getMemberMatchers(getGroups, getPeriod),
        ...paymentMatchers,
        ...parentMatchers1,
        ...parentMatchers2,
    ];

    const recordCategories = [
        ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
        ...platform.config.recordsConfiguration.recordCategories,
    ];

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    for (const category of flattenedCategories) {
        for (const record of category.getAllRecords()) {
            switch (record.type) {
                case RecordType.Textarea:
                case RecordType.Phone:
                case RecordType.Email:
                case RecordType.Text: {
                    matchers.push(new TextColumnMatcher({
                        name: record.name.toString(),
                        category: category.name.toString(),
                        required: false,
                        save(value: string, importResult: ImportMemberResult) {
                            ColumnMatcherHelper.patchRecordTextdAnswer(importResult, value, record);
                        },
                    }));
                    break;
                }
                case RecordType.Address: {
                    matchers.push(new AddressColumnMatcher({
                        name: record.name.toString(),
                        category: category.name.toString(),
                        required: false,
                        save(value: Address, importResult: ImportMemberResult) {
                            ColumnMatcherHelper.patchRecordAddressAnswer(importResult, value, record);
                        },
                    }));
                    break;
                }
                case RecordType.Date: {
                    matchers.push(new DateColumnMatcher({
                        name: record.name.toString(),
                        category: category.name.toString(),
                        required: false,
                        save(value: Date, importResult: ImportMemberResult) {
                            ColumnMatcherHelper.patchRecordDateAnswer(importResult, value, record);
                        },
                    }));
                    break;
                }
            }
        }
    }

    return matchers;
};
