import { SimpleError } from '@simonbackx/simple-errors';
import { StringCompare } from '@stamhoofd/utility';
import XLSX from 'xlsx';
import { GeneralMemberDetailsMatcher } from '../GeneralMemberDetailsMatcher';

export class DateColumnMatcher extends GeneralMemberDetailsMatcher<Date> {
    parseObject(cell: XLSX.CellObject): Date | undefined {
        if (!cell) {
            return;
        }

        if (cell.t === 'd') {
            // date
            if (!(cell.v instanceof Date) || !cell.v) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Onverwachte datum in deze cel`),
                });
            }

            return cell.v;
        }

        const text = (cell.w ?? cell.v) as string;

        if (cell.t === 'n' && typeof cell.v === 'number') {
            /**
             * https://github.com/SheetJS/sheetjs/issues/279
             * © pushpenderjunglee, arliber
             * Excel stores timestamps as a real number representing the number of days since 1 January 1900. 25569 is the number of days between 1 January 1900 and 1 January 1970, which is what we need to convert to a UNIX timestamp that can be used for Date.
             */
            const utc_value = (cell.v - 25569) * 86400;
            const date_info = new Date(utc_value * 1000);

            // for some crazy reason, sheetJS already added the UTC time offset to the UTC value (wtf why?). So we need to remove it again
            const corrected_date = new Date(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate(), date_info.getUTCHours(), date_info.getUTCMinutes(), date_info.getUTCSeconds());
            return corrected_date;
        }
        else if (cell.t !== 's' || typeof cell.v !== 'string' || !cell.v) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`Geen tekst in deze cel`),
            });
        }

        return this.parse(text);
    }

    parse(str: string) {
        const usa = false;
        const sep = this.getDateSeparator(str);
        const parts = str.split(sep);

        if (parts.length !== 3) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`Ongeldige datum. Probeer in de vorm zoals 20/08/1995`),
            });
        }

        const numbersClean: number[] = [];
        let hadMonth = false;

        for (const part of parts) {
            if (part.match(/^\s*[0-9]+\s*$/)) {
                const num = parseInt(part.trim());
                numbersClean.push(num);
            }
            else {
                if (hadMonth) {
                    throw new SimpleError({
                        code: 'invalid_type',
                        message: $t(`Ongeldige datum. Probeer in de vorm zoals 20/08/1995`),
                    });
                }
                hadMonth = true;
                numbersClean.push(this.stringToMonth(part));
            }
        }

        // now get the order
        // TODO: for USA, alwasy switch month and day

        if (numbersClean.length !== 3) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`Ongeldige datum. Probeer in de vorm zoals 20/08/1995`),
            });
        }

        const currentYear = new Date().getFullYear();
        const year = currentYear - 2000;
        const maxAge = 125;

        const first = numbersClean[0];
        if (first > 999) {
            if (usa) {
                // Not a usa format, ignore
            }

            if (first < currentYear - maxAge || first > currentYear) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Ongeldig jaar. '{year}' is geen geldig jaar. Probeer in de vorm zoals 20/08/1995`, { year: first }),
                });
            }
            if (numbersClean[1] > 12 || numbersClean[1] < 1) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Ongeldige datum. '{date}' is geen geldige maand. Probeer in de vorm zoals 20/08/1995`, { date: numbersClean[1] }),
                });
            }
            if (numbersClean[2] > 31 || numbersClean[2] < 1) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Ongeldige datum. '{date}' is geen geldige dag. Probeer in de vorm zoals 20/08/1995`, { date: numbersClean[2] }),
                });
            }
            return new Date(numbersClean[0], numbersClean[1] - 1, numbersClean[2]);
        }

        const last = numbersClean[2];

        if (last > 999) {
            if (last < currentYear - maxAge || last > currentYear) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Ongeldig jaar. '{year}' is geen geldig jaar. Probeer in de vorm zoals 20/08/1995`, { year: last }),
                });
            }

            if (usa) {
                // Swap first two (USA format)
                const month = numbersClean[0];
                const day = numbersClean[1];
                numbersClean[0] = day;
                numbersClean[1] = month;
            }

            if (numbersClean[1] > 12 || numbersClean[1] < 1) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Ongeldige datum. '{date}' is geen geldige maand. Probeer in de vorm zoals 20/08/1995`, { date: numbersClean[1] }),
                });
            }
            if (numbersClean[0] > 31 || numbersClean[0] < 1) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Ongeldige datum. '{date}' is geen geldige dag. Probeer in de vorm zoals 20/08/1995`, { date: numbersClean[2] }),
                });
            }
            return new Date(numbersClean[2], numbersClean[1] - 1, numbersClean[0]);
        }

        // default to last is year, in two chars, in 2000 if smaller than current year number
        if (last > 99 || last < 0) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`Ongeldig jaar. Probeer in de vorm zoals 20/08/1995`),
            });
        }

        if (usa) {
            // Swap first two (USA format)
            const month = numbersClean[0];
            const day = numbersClean[1];
            numbersClean[0] = day;
            numbersClean[1] = month;
        }

        // default to last is year, in 2000 if smaller than current year number
        if (numbersClean[1] > 12 || numbersClean[1] < 1) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`Ongeldige datum. '{date}' is geen geldige maand. Probeer in de vorm zoals 20/08/1995`, { date: numbersClean[1] }),
            });
        }
        if (numbersClean[0] > 31 || numbersClean[0] < 1) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`Ongeldige datum. '{date}' is geen geldige dag. Probeer in de vorm zoals 20/08/1995`, { date: numbersClean[2] }),
            });
        }

        if (last <= year) {
            // 21th century
            return new Date(numbersClean[2] + 2000, numbersClean[1] - 1, numbersClean[0]);
        }
        else {
            // 20th century
            return new Date(numbersClean[2] + 1900, numbersClean[1] - 1, numbersClean[0]);
        }
    }

    stringToMonth(str: string) {
        const months = [
            ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
            ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'oktober', 'november', 'december'],

            ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
            ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
        ];

        for (const rows of months) {
            let bestMatch: number | null = null;
            let bestScore = 0;
            for (const [index, month] of rows.entries()) {
                const typo = StringCompare.typoCount(month, str);
                if (((typo <= 2 && month.length > 3) || typo === 0) && (bestMatch === null || bestScore > typo)) {
                    bestScore = typo;
                    bestMatch = index;
                }
            }

            if (bestMatch) {
                return bestMatch + 1;
            }
        }

        throw new SimpleError({
            code: 'invalid_type',
            message: $t(`Ongeldige datum. Kon '{date}' niet omzetten in een geldige maand`, { date: str }),
        });
    }

    getDateSeparator(str: string) {
        if (str.includes('/')) {
            return '/';
        }
        if (str.includes('-')) {
            return '-';
        }
        if (str.includes('.')) {
            return '.';
        }
        if (str.includes(' ')) {
            return ' ';
        }

        throw new SimpleError({
            code: 'invalid_type',
            message: $t(`Ongeldige datum. Probeer in de vorm zoals 20/08/1995`),
        });
    }
}
