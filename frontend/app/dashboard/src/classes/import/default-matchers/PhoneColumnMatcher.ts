import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Country, countryCodes } from '@stamhoofd/structures';
import { PhoneNumber } from 'libphonenumber-js';
import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class PhoneColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher {
    getName(): string {
        return $t('3174ba16-f035-4afd-a69f-74865e64ef34');
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        for (const word of ['lidnummer', 'rijksregister', 'bestel', ...this.negativeMatch]) {
            if (cleaned.includes(word)) {
                return false;
            }
        }

        const possibleMatch = ['telefoon', 'gsm', 'nummer', 'mobiel', 'mobile', 'phone'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true;
            }
        }
        return false;
    }

    async setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell) {
            return;
        }

        const phoneRaw = ((cell.w ?? cell.v) + '').trim();

        if (!phoneRaw) {
            // Not required field
            return;
        }

        const libphonenumber = await import(/* webpackChunkName: "libphonenumber" */ 'libphonenumber-js/max');

        let phoneNumber: PhoneNumber | undefined = undefined;
        try {
            phoneNumber = libphonenumber.parsePhoneNumber(phoneRaw, I18nController.shared?.countryCode ?? Country.Belgium);
        }
        catch (e: any) {
            throw new SimpleError({
                code: 'invalid_field',
                message: e.message || 'Invalid phone',
                human: $t(`16c76c49-48f8-4532-91ae-97867c2ad668`),
                field: 'phone',
            });
        }

        if (!phoneNumber || !phoneNumber.isValid()) {
            for (const countryCode of countryCodes) {
                try {
                    const phoneNumber = libphonenumber.parsePhoneNumber(phoneRaw, countryCode);

                    if (phoneNumber && phoneNumber.isValid()) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: $t('2ed46ae7-03d8-4a9c-8555-0edfc7157d53'),
                            field: 'phone',
                        });
                    }
                }
                catch (e: any) {
                    if (isSimpleError(e) || isSimpleErrors(e)) {
                        throw e;
                    }

                    throw new SimpleError({
                        code: 'invalid_field',
                        message: e.message || 'Invalid phone',
                        human: $t(`16c76c49-48f8-4532-91ae-97867c2ad668`),
                        field: 'phone',
                    });
                }
            }

            throw new SimpleError({
                code: 'invalid_field',
                message: $t('0bf875c9-f6a8-417d-82dd-4d6bfff9669f'),
                field: 'phone',
            });
        }

        const v = phoneNumber.formatInternational();

        if (this.category === MemberDetailsMatcherCategory.Member as string) {
            importResult.addPatch({
                phone: v,
            });
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1 as string || this.category === MemberDetailsMatcherCategory.Parent2 as string) {
            ColumnMatcherHelper.patchParent(importResult, this.category as (MemberDetailsMatcherCategory.Parent1 | MemberDetailsMatcherCategory.Parent2), {
                phone: v,
            });
        }
    }
}
