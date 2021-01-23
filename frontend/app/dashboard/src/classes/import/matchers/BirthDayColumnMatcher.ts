import { SimpleError } from "@simonbackx/simple-errors";
import { Gender } from "@stamhoofd/structures";
import { StringCompare } from "@stamhoofd/utility";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";

export class BirthDayColumnMatcher implements ColumnMatcher {
    id = this.constructor.name
    category: MatcherCategory = MatcherCategory.Member

    getName(): string {
        return "Geboortedatum"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        const possibleMatch = ["geboortedatum", "verjaardag", "birth day"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Deze cel is leeg"
            })
        }
        if (cell.t === "d") {
            // date
            if (!(cell.v instanceof Date) || !cell.v) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Onverwachte datum in deze cel"
                })
            }

            member.details.birthDay = cell.v
            return
        }

        let text = cell.w ?? cell.v as string
        let usa = false

        if (cell.t == "n" && cell.w) {
            text = cell.w
            usa = true
        } else if (cell.t != "s" || typeof cell.v !== "string" || !cell.v) {
            console.log(cell)
            throw new SimpleError({
                code: "invalid_type",
                message: "Geen tekst in deze cel"
            })
        }

        member.details.birthDay = this.parseDate(text, usa)
        
    }

    parseDate(str: string, usa = false) {
        const sep = this.getDateSeparator(str)
        const parts = str.split(sep)

        if (parts.length != 3) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Ongeldige datum. Probeer in de vorm zoals 20/08/1995"
            })
        }

        const numbersClean: number[] = []
        let hadMonth = false

        for (const part of parts) {
            // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
            if (part.match(/^\s*[0-9]+\s*$/)) {
                const num = parseInt(part.trim())
                numbersClean.push(num)
            } else {
                if (hadMonth) {
                    throw new SimpleError({
                        code: "invalid_type",
                        message: "Ongeldige datum. Probeer in de vorm zoals 20/08/1995"
                    })
                }
                hadMonth = true
                numbersClean.push(this.stringToMonth(str))
            }
        }

        // now get the order
        // todo: for USA, alwasy switch month and day

        if (numbersClean.length != 3) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Ongeldige datum. Probeer in de vorm zoals 20/08/1995"
            })
        }

        const currentYear = new Date().getFullYear()
        const year = currentYear - 2000
        const maxAge = 125

        const first = numbersClean[0]
        if (first > 999) {
            if (usa) {
                // Not a usa format, ignore
            }

            if (first < currentYear - maxAge  || first > currentYear) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Ongeldig jaar. '"+ first +"' is geen geldig jaar. Probeer in de vorm zoals 20/08/1995"
                })
            }
            if (numbersClean[1] > 12 || numbersClean[1] < 1) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Ongeldige datum. '"+ numbersClean[1] +"' is geen geldige maand. Probeer in de vorm zoals 20/08/1995"
                })
            }
            if (numbersClean[2] > 31 || numbersClean[2] < 1) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Ongeldige datum. '"+ numbersClean[2] +"' is geen geldige dag. Probeer in de vorm zoals 20/08/1995"
                })
            }
            return new Date(numbersClean[0], numbersClean[1] - 1, numbersClean[2])
        }

        const last = numbersClean[2]

        if (last > 999) {
            if (last < currentYear - maxAge  || last > currentYear) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Ongeldig jaar. '"+ last+"' is geen geldig jaar. Probeer in de vorm zoals 20/08/1995"
                })
            }

            if (usa) {
                // Swap first two (USA format)
                const month = numbersClean[0]
                const day = numbersClean[1]
                numbersClean[0] = day
                numbersClean[1] = month
            }
            
            if (numbersClean[1] > 12 || numbersClean[1] < 1) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Ongeldige datum. '"+ numbersClean[1] +"' is geen geldige maand. Probeer in de vorm zoals 20/08/1995"
                })
            }
            if (numbersClean[0] > 31 || numbersClean[0] < 1) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Ongeldige datum. '"+ numbersClean[2] +"' is geen geldige dag. Probeer in de vorm zoals 20/08/1995"
                })
            }
            return new Date(numbersClean[2], numbersClean[1] - 1, numbersClean[0])
        }

        // default to last is year, in two chars, in 2000 if smaller than current year number
        if (last > 99 || last < 0) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Ongeldig jaar. Probeer in de vorm zoals 20/08/1995"
            })
        }

        if (usa) {
            // Swap first two (USA format)
            const month = numbersClean[0]
            const day = numbersClean[1]
            numbersClean[0] = day
            numbersClean[1] = month
        }

        // default to last is year, in 2000 if smaller than current year number
        if (numbersClean[1] > 12 || numbersClean[1] < 1) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Ongeldige datum. '"+ numbersClean[1] +"' is geen geldige maand. Probeer in de vorm zoals 20/08/1995"
            })
        }
        if (numbersClean[0] > 31 || numbersClean[0] < 1) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Ongeldige datum. '"+ numbersClean[2] +"' is geen geldige dag. Probeer in de vorm zoals 20/08/1995"
            })
        }
        
        if (last <= year) {
            // 21th century
            return new Date(numbersClean[2] + 2000, numbersClean[1] - 1, numbersClean[0])
        } else {
            // 20th century
            return new Date(numbersClean[2] + 1900, numbersClean[1] - 1, numbersClean[0])
        }
    }

    stringToMonth(str: string) {
        const months = [
            ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
            ["january", "february", "march", "april", "may", "june", "july", "august", "september", "oktober", "november", "december"],

            ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
            ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
        ]

        for (const rows of months) {
            let bestMatch: number | null = null
            let bestScore = 0
            for (const [index, month] of rows.entries()) {
                const typo = StringCompare.typoCount(month, str)
                if (typo <= 2 && (bestMatch === null || bestScore > typo)) {
                    bestScore = typo
                    bestMatch = index
                }
            }

            if (bestMatch) {
                return bestMatch + 1
            }
        }

        throw new SimpleError({
            code: "invalid_type",
            message: "Ongeldige datum. Kon '"+str+"' niet omzetten in een geldige maand"
        })
    }

    getDateSeparator(str: string) {
        if (str.includes("/")) {
            return "/"
        }
        if (str.includes("-")) {
            return "-"
        }
        if (str.includes(".")) {
            return "."
        }
        if (str.includes(" ")) {
            return " "
        }

        throw new SimpleError({
            code: "invalid_type",
            message: "Ongeldige datum. Probeer in de vorm zoals 20/08/1995"
        })
    }
}