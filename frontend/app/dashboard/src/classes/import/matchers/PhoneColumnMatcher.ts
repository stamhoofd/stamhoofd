import { SimpleError } from "@simonbackx/simple-errors";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { Country, Parent, ParentType } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";
import { SharedMatcher } from "../SharedMatcher";

export class PhoneColumnMatcher extends SharedMatcher implements ColumnMatcher {
    getName(): string {
        return I18nController.i18n.t("shared.inputs.mobile.label").toString()
    }

    get id() {
        return this.getName()+"-"+this.category
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        for (const word of ["lidnummer", ...this.negativeMatch]) {
            if (cleaned.includes(word)) {
                return false
            }
        }
        
        const possibleMatch = ["telefoon", "gsm", "nummer", "mobiel", "mobile", "phone", "tel"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }

    async apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell) {
            return
        }

        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const phoneRaw = ((cell.w ?? cell.v)+"").trim()
        const libphonenumber = await import(/* webpackChunkName: "libphonenumber" */ "libphonenumber-js/max")
        const phoneNumber = libphonenumber.parsePhoneNumberFromString(phoneRaw, I18nController.shared?.country ?? Country.Belgium)

        if (!phoneNumber || !phoneNumber.isValid()) {
            for (const country of Object.values(Country)) {
                const phoneNumber = libphonenumber.parsePhoneNumber(phoneRaw, country)

                if (phoneNumber && phoneNumber.isValid()) {
                    throw new SimpleError({
                        "code": "invalid_field",
                        "message": I18nController.i18n.t("shared.inputs.mobile.invalidMessageTryCountry").toString(),
                        "field": "phone"
                    })
                }
            }
            throw new SimpleError({
                "code": "invalid_field",
                "message": I18nController.i18n.t("shared.inputs.mobile.invalidMessage").toString(),
                "field": "phone"
            })
        }

        const v = phoneNumber.formatInternational();

        if (this.category == MatcherCategory.Member) {
            member.details.phone = v
        } else if (this.category == MatcherCategory.Parent1) {
            if (member.details.parents.length == 0) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent1
                }))
            }
            member.details.parents[0].phone = v
        } else if (this.category == MatcherCategory.Parent2) {
            while (member.details.parents.length < 2) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent2
                }))
            }
            member.details.parents[1].phone = v
        }
    }
}