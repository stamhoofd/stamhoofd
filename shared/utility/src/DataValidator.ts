import { Formatter } from './Formatter.js';
import { StringCompare } from './StringCompare.js';

export class DataValidator {
    static readonly UITPAS_NUMBER_REGEX = /^\d{10,13}$/;

    static isEmailValid(str: string) {
        const blockList = [
            'gmail.be',
            'gmail.nl',
            'icloud.be',
        ];
        const regex = /^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

        if (!regex.test(str)) {
            return false;
        }

        for (const l of blockList) {
            if (str.endsWith('@' + l)) {
                return false;
            }
        }

        const domain = str.split('@')[1];
        if (domain.length > 255) {
            return false;
        }

        const typo = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'hotmail.be', 'yahoo.com', 'live.com', 'outlook.com', 'icloud.com', 'skynet.be', 'telenet.be', 'proximus.be', 'scarlet.be', 'vodafone.be', 'orange.be'];
        let foundInvalid = false;
        for (const t of typo) {
            if (domain === t) {
                return true;
            }
            if (StringCompare.typoCount(domain, t) === 1) {
                foundInvalid = true;
            }
        }

        if (domain === 'mail.com') {
            // Exception for typo on gmail.com
            return true;
        }

        if (foundInvalid) {
            return false;
        }

        const tld = domain.split('.').pop();
        if (!tld || tld.length < 2) {
            return false;
        }

        return true;
    }

    static isUitpasNumberValid(str: string) {
        return this.UITPAS_NUMBER_REGEX.test(str);
    }

    static isUuid(value: unknown) {
        if (typeof value !== 'string') {
            return false;
        }
        return value.length === 36 && value[8] === '-' && value[13] === '-' && value[18] === '-' && value[23] === '-';
    }

    static formatUitpasNumber(text: string) {
        const trimmed = this.cleanUitpasNumber(text);
        // XXXX XXX XXX XXX
        return Formatter.injectPattern(trimmed, [
            { length: 4 },
            ' ',
            { length: 3 },
            ' ',
            { length: 3 },
            ' ',
            { length: 3 },
        ]);
    }

    static verifyBelgianNationalNumber(text: string) {
        const trimmed = text.replace(/[^0-9]+/g, ''); // keep A-Z for validation
        if (trimmed.length !== 11) {
            return false;
        }
        const toCheck = parseInt(trimmed.substring(0, trimmed.length - 2));
        const checksum = parseInt(trimmed.substring(trimmed.length - 2));

        // we calculate the expected checksum. again
        const realChecksum = 97 - (toCheck % 97); // Dates before 2000
        const realChecksum2 = 97 - ((2000000000 + toCheck) % 97); // Dates after 2000

        if (STAMHOOFD.environment === 'development') {
            return true;
        }

        if (checksum === realChecksum || checksum === realChecksum2) {
            // Check birth day via doesMatchBelgianNationalNumber
            return true;
        }
        return false;
    }

    static doesMatchBelgianNationalNumber(text: string, birthDay: Date | null) {
        if (!birthDay) {
            return true;
        }

        // Check if year, month and day matches
        const generated = this.generateBelgianNationalNumber(birthDay);
        if (this.formatBelgianNationalNumber(text).startsWith(generated)) {
            return true;
        }
        return false;
    }

    static cleanBelgianNationalNumber(text: string) {
        return text.replace(/[^0-9]+/g, '');
    }

    static cleanUitpasNumber(text: string) {
        return text.replace(/[^0-9]+/g, '');
    }

    static getUitpasNumberInputFormatter() {
        return {
            cleaner: (value: string) => {
                return this.cleanUitpasNumber(value);
            },
            formatter: (value: string) => {
                return this.formatUitpasNumber(value);
            },
        };
    }

    static getBelgianNationalNumberInputFormatter() {
        return {
            cleaner: (value: string) => {
                return this.cleanBelgianNationalNumber(value);
            },
            formatter: (value: string) => {
                return this.formatBelgianNationalNumber(value);
            },
        };
    }

    static formatBelgianNationalNumber(text: string) {
        const trimmed = this.cleanBelgianNationalNumber(text);
        // JJ.MM.DD-XXX.XX
        return Formatter.injectPattern(trimmed, [
            { length: 2 },
            '.',
            { length: 2 },
            '.',
            { length: 2 },
            '-',
            { length: 3 },
            '.',
            { length: 2 },
        ]);
    }

    static generateBelgianNationalNumber(date: Date): string {
        // JJ.MM.DD-

        const year = Formatter.year(date).toFixed();
        const month = Formatter.monthNumber(date).toFixed();
        const day = Formatter.day(date);

        return year.substring(2) + '.' + month.padStart(2, '0') + '.' + day.padStart(2, '0') + '-';
    }
}
