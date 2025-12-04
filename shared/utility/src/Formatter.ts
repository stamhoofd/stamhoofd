import { DateTime } from 'luxon';
import { friendlyFormatIBAN } from 'ibantools';
import { Sorter } from './Sorter.js';

export class Formatter {
    static timezone = 'Europe/Brussels';

    static removeAccents(name: StringLike): string {
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    static emailSenderName(name: StringLike): string {
        return this.removeAccents(name).replace(/[^A-Za-z0-9-_]+/g, ' ').trim();
    }

    static iban(ibanRaw: string) {
        try {
            return friendlyFormatIBAN(ibanRaw) ?? ibanRaw; // 'NL91ABNA0517164300'
        }
        catch (e) {
            console.error('Invalid IBAN', ibanRaw, e);
            return ibanRaw; // Return the raw IBAN if it cannot be formatted
        }
    }

    static slug(name: StringLike): string {
        return this.removeAccents(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    }

    static slugEmail(name: StringLike): string {
        return this.removeAccents(name).toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    }

    static fileSlug(name: StringLike): string {
        return this.removeAccents(name).replace(/[^A-Za-z0-9-]+/g, ' ').trim();
    }

    static sepaPaymentSlug(name: string): string {
        // https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/sepa-requirements-extended-character-set-unicode-subset-best
        return this.removeAccents(name).replace(/[^A-Za-z0-9-.:'+]+/g, ' ').trim();
    }

    static removeDuplicateSpaces(name: StringLike): string {
        return name.replace(/\s+/, ' ');
    }

    static spaceString(str: string, spaceLength: number = 4, spaceChar = '\u00A0'): string {
        // Insert a non breaking space every 4 characters without a regex
        let result = '';
        for (let i = 0; i < str.length; i++) {
            if (i % spaceLength === 0 && i > 0) {
                result += spaceChar;
            }
            result += str[i];
        }
        return result;
    }

    static stringToNumber(str: string, maxInt = 256) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
        }
        return Math.abs(hash) % maxInt;
    }

    /**
     * 1 = january
     */
    static month(index: number | Date): string {
        if (typeof index === 'object') {
            const datetime = DateTime.fromJSDate(index).setZone(this.timezone);
            index = datetime.month;
        }

        // todo translation
        const monthNames = [$t(`29fbce51-68a6-4733-9ee5-65897d71d37c`), $t(`5679c122-7063-478c-868f-97f8d01748f3`), $t(`ccf1e00d-f719-4718-9555-25acfe285c8c`), $t(`7b92fc9f-883f-43ff-acf7-3490b419bf94`), $t(`0ae99c01-f294-4442-99a3-cef8a2e23788`), $t(`7ea3c6c8-94cc-4fa1-bc8d-8f53f1951db1`),
            $t(`9b819734-da73-4243-9d6c-9e0603170061`), $t(`8caa99d4-ef69-43e3-a14c-e09e62e629b0`), $t(`07394488-70c1-4c7c-9e20-29bda64b53d0`), $t(`3c390322-a9dd-43c7-9f2a-3d766d021169`), $t(`b9bab2b4-5621-4133-b4e4-72fbacb1c203`), $t(`3476c558-2f2c-4fbf-b745-e4d09d79a819`),
        ];
        return monthNames[index - 1];
    }

    /**
     * 1-31
     */
    static day(date: Date): string {
        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return datetime.day.toFixed(0);
    }

    static weekDay(date: Date): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }

        // todo translation
        const monthNames = [$t(`9f872d61-a2e3-4e8b-9a73-dfcf8c2e466e`), $t(`795a3c1a-62ca-4c6b-9165-e1740ddb95ef`), $t(`48f788e9-feb9-451e-a036-5dc25b233893`), $t(`1d96b17c-1c1f-4679-9bba-61be0eda3cf7`), $t(`1b7a2a1f-8d62-4c3d-95f1-911a0a8407f7`), $t(`7ab415c5-4e09-4165-89f8-035b80eda1a7`), $t(`8c0f8856-855b-4105-a77e-3d883ac7f641`)];

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return monthNames[datetime.weekday - 1];
    }

    /**
     * 1 januari (2020). Year only in different year and in the future, if withYear is null (default)
     */
    static date(date: Date, withYear: boolean | null = null): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        const currentYear = DateTime.now().setZone(this.timezone).year;

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        const year = datetime.year;
        return datetime.day + ' ' + this.month(datetime.month) + (withYear !== false && (currentYear !== year || withYear === true || date < new Date()) ? (' ' + year) : '');
    }

    /**
     * 5 = 5 dagen
     * 7 = 1 week
     * 8 = 8 dagen
     * ...
     */
    static days(days: number) {
        const weeks = days / 7;
        const dividable = days % 7;

        if (weeks > 0 && dividable === 0) {
            if (weeks === 1) {
                return $t(`9965a103-1ff5-444d-99f4-39fb0adb903b`);
            }
            return weeks + ' ' + $t(`df3cfead-38d4-478b-b769-8c410a199a30`);
        }

        if (days === 1) {
            return $t(`bab8eb22-0fdf-4840-bcf0-3fcce710e429`);
        }

        return $t(`2b7f5d07-3f1a-4aeb-8dd4-b398dfb5eb8c`, { days: days.toString() });
    }

    static relativeTime(date: Date, options?: { days?: boolean; hours?: boolean }) {
        const now = Date.now();
        let diff = now - date.getTime();

        const days = Math.floor(diff / (60 * 1000 * 60 * 24));

        diff = diff % (60 * 1000 * 60 * 24);
        const hours = Math.floor(diff / (60 * 1000 * 60));
        diff = diff % (60 * 1000 * 60);

        const minutes = Math.floor(diff / (60 * 1000));

        if (days > 0) {
            if (options?.days === false || options?.hours === false) {
                return this.dateTime(date, true, true);
            }
            if (days === 1) {
                return $t(`f2410f5c-475c-47fb-a50c-27b9467e29d9`);
            }
            return $t(`63ba061b-a809-44a3-8b1e-c6e35f6147de`, { days: days.toString() });
        }

        if (hours > 0) {
            if (options?.hours === false) {
                return this.dateTime(date, true, true);
            }

            if (hours === 1) {
                return $t(`4662f109-d369-4892-b7b2-dfc975f3b2ef`);
            }
            return $t(`561954e1-e7c2-4b0c-88b3-29140e7020a5`, { hours: hours.toString() });
        }

        if (minutes > 0) {
            if (minutes === 1) {
                return $t(`cdc1ea2a-5cc4-4c47-bbd1-eea90b7612be`);
            }
            return $t(`771b03ee-23b2-40b2-b418-01a116066919`, { minutes: minutes.toString() });
        }

        const seconds = Math.floor(diff / 1000);
        if (seconds > 0) {
            if (seconds === 1) {
                return $t(`7a6279fd-feba-47de-b66b-ea99f08e9800`);
            }
            return $t(`aae5e3da-7bc1-4d0a-bf0b-56b97c017ba2`, { seconds: seconds.toString() });
        }

        return $t(`5e3c0459-3ee0-4c2f-9657-5e189dbf749d`);
    }

    /**
     * januari 2020
     */
    static dateWithoutDay(date: Date, options?: { timezone?: string }): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        const datetime = DateTime.fromJSDate(date).setZone(options?.timezone ?? this.timezone);
        const year = datetime.year;
        return this.month(datetime.month) + ' ' + year;
    }

    /**
     * 2020
     */
    static year(date: Date): number {
        if (!date) {
            // Crash protection in case undefined get passed
            return 0;
        }
        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return datetime.year;
    }

    // 1 - 12
    static monthNumber(date: Date): number {
        if (!date) {
            // Crash protection in case undefined get passed
            return 0;
        }
        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return datetime.month;
    }

    /**
     * maandag, 1 januari (2020). Year only in different year
     */
    static dateWithDay(date: Date, withYear: boolean | null = null): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        return this.weekDay(date) + ', ' + this.date(date, withYear);
    }

    /**
     * maandag, 1 januari (2020) om XX:XX. Year only in different year
     */
    static dateTimeWithDay(date: Date, hideZero = false, withYear: boolean | null = null): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        return this.weekDay(date) + ', ' + this.dateTime(date, hideZero, withYear);
    }

    /**
     * 01/01/2020
     */
    static dateNumber(date: Date, withYear = true): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return (datetime.day + '').padStart(2, '0') + '/' + (datetime.month + '').padStart(2, '0') + (withYear ? '/' + datetime.year : '');
    }

    /**
     * 2020-01-31
     */
    static dateIso(date: Date): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        const year = datetime.year;
        return year + '-' + (datetime.month + '').padStart(2, '0') + '-' + (datetime.day + '').padStart(2, '0');
    }

    /**
     * 2020-01-31 00:00:00
     */
    static dateTimeIso(date: Date, timezone?: string): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }

        const datetime = DateTime.fromJSDate(date).setZone(timezone ?? this.timezone);
        const year = datetime.year;
        return year + '-' + (datetime.month + '').padStart(2, '0') + '-' + (datetime.day + '').padStart(2, '0') + ' ' + (datetime.hour + '').padStart(2, '0') + ':' + (datetime.minute + '').padStart(2, '0') + ':' + (datetime.second + '').padStart(2, '0');
    }

    static startDate(startDate: Date, includeDay = false, withYear: boolean | null = null, includeTime: boolean | null = null): string {
        if (includeTime === false) {
            if (includeDay) {
                return Formatter.dateWithDay(startDate, withYear);
            }
            return Formatter.date(startDate, withYear);
        }

        if (includeDay) {
            return Formatter.dateTimeWithDay(startDate, includeTime === null, withYear);
        }
        return Formatter.dateTime(startDate, includeTime === null, withYear);
    }

    static endDate(endDate: Date, includeDay = false, withYear: boolean | null = null, includeTime: boolean | null = null): string {
        if ((Formatter.time(endDate) === '23:59' && includeTime === null) || includeTime === false) {
            if (includeDay) {
                return Formatter.dateWithDay(endDate, withYear);
            }
            return Formatter.date(endDate, withYear);
        }

        if (includeDay) {
            return Formatter.dateTimeWithDay(endDate, false, withYear);
        }
        return Formatter.dateTime(endDate, false, withYear);
    }

    static dateRange(startDate: Date, endDate: Date, join = ' - ', includeTime: boolean | null = null): string {
        if (Formatter.dateIso(startDate) === Formatter.dateIso(endDate)) {
            if (Formatter.time(startDate) === Formatter.time(endDate) || includeTime === false) {
                return Formatter.dateWithDay(startDate) + (includeTime !== false ? (', ' + Formatter.time(startDate)) : '');
            }

            if (Formatter.time(startDate) === '0:00' && Formatter.time(endDate) === '23:59') {
                return Formatter.dateWithDay(startDate);
            }

            return Formatter.dateWithDay(startDate) + ', ' + Formatter.time(startDate) + join + Formatter.time(endDate);
        }

        // If start in evening and end on the next morning: only mention date once
        const differentYear = startDate < new Date() || Formatter.year(startDate) !== Formatter.year(endDate) || Formatter.year(startDate) !== Formatter.year(new Date());
        if (Formatter.dateIso(startDate) === Formatter.dateIso(new Date(endDate.getTime() - 24 * 60 * 60 * 1000)) && Formatter.timeIso(endDate) <= '07:00' && Formatter.timeIso(startDate) >= '12:00') {
            return Formatter.dateWithDay(startDate, differentYear) + (includeTime !== false ? (', ' + Formatter.time(startDate) + join + Formatter.time(endDate)) : '');
        }

        if (Formatter.monthNumber(startDate) === Formatter.monthNumber(endDate) && Formatter.year(startDate) === Formatter.year(endDate)) {
            // Only repeat number
            if (includeTime === false || (Formatter.time(startDate) === '0:00' && Formatter.time(endDate) === '23:59')) {
                const currentYear = DateTime.now().setZone(this.timezone).year;
                const startDatetime = DateTime.fromJSDate(startDate).setZone(this.timezone);
                const endDatetime = DateTime.fromJSDate(endDate).setZone(this.timezone);

                const year = startDatetime.year;
                return startDatetime.day + join + endDatetime.day + ' ' + this.month(startDatetime.month) + (currentYear !== year || startDate < new Date() ? (' ' + year) : '');
            }
        }

        return Formatter.startDate(startDate, false, differentYear, includeTime) + join + Formatter.endDate(endDate, false, differentYear, includeTime);
    }

    /**
     * 12:00
     */
    static time(date: Date, timeZone = this.timezone): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        const datetime = DateTime.fromJSDate(date).setZone(timeZone);
        return datetime.hour + ':' + (datetime.minute + '').padStart(2, '0');
    }

    static luxon(date = new Date()): DateTime {
        return DateTime.fromJSDate(date).setZone(this.timezone);
    }

    /**
     * 12:00
     */
    static timeIso(date: Date): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return (datetime.hour + '').padStart(2, '0') + ':' + (datetime.minute + '').padStart(2, '0');
    }

    static uniqueArray<T>(array: T[]): T[] {
        function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        }

        return array.filter(onlyUnique);
    }

    /**
     * 1 januari (2020) om 12:00. Year only in different year
     */
    static dateTime(date: Date, hideZero = false, withYear: boolean | null = null): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        if (hideZero && this.time(date) === '0:00') {
            return this.date(date, withYear);
        }
        return this.date(date, withYear) + ' ' + $t(`8ae93138-5aeb-4bd4-8845-d57c1e2d62f2`) + ' ' + this.time(date);
    }

    static integer(value: number): string {
        const formatted = new Intl.NumberFormat('nl-BE').format(Math.abs(value));

        const v = (value < 0 ? '- ' : '') + formatted;

        return v;
    }

    static float(value: number): string {
        const formatted = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 }).format(Math.abs(value));

        const v = (value < 0 ? '- ' : '') + formatted;

        return v;
    }

    static percentage(value: number): string {
        const formatted = new Intl.NumberFormat('nl-BE').format(Math.abs(value / 100));

        const v = (value < 0 ? '- ' : '') + formatted;

        return v + '%';
    }

    static price(value: number, removeZeroDecimals = true): string {
        const formatted = new Intl.NumberFormat('nl-BE', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 4,
            minimumFractionDigits: 2,
        }).format(Math.abs(value) / 100_00);

        const v = (value < 0 ? '- ' : '') + formatted.replace(new RegExp('EUR', 'ig'), '€');
        if (removeZeroDecimals && (v.endsWith(',00') || v.endsWith('.00'))) {
            return v.substring(0, v.length - 3);
        }

        return v;
    }

    static priceChange(value: number): string {
        if (value >= 0) {
            return '+ ' + this.price(value);
        }
        return this.price(value);
    }

    static capitalizeFirstLetter(string: StringLike) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    static capitalizeWords(string: StringLike) {
        return string.split(' ').map(s => this.capitalizeFirstLetter(s)).join(' ');
    }

    static fileSize(bytes: number) {
        if (bytes < 1000) {
            return bytes + ' bytes';
        }

        if (bytes < 1000 * 1000) {
            return Math.round(bytes / 1000) + ' kB';
        }

        if (bytes < 1000 * 1000 * 1000) {
            return Math.round(bytes / 1000 / 100) / 10 + ' MB';
        }

        return Math.round(bytes / 1000 / 1000 / 10) / 100 + ' GB';
    }

    static minutesPadded(minutes: number): string {
        const h = Math.floor(minutes / 60);
        const m = minutes - h * 60;
        return (h + '').padStart(2, '0') + ':' + (m + '').padStart(2, '0');
    }

    static timeIndex(minutes: number): string {
        const h = Math.floor(minutes / 60);
        const m = minutes - h * 60;
        return (h + '').padStart(2, '0') + (m + '').padStart(2, '0');
    }

    static minutes(minutes: number): string {
        const h = Math.floor(minutes / 60);
        const m = minutes - h * 60;
        return h + ':' + (m + '').padStart(2, '0');
    }

    static escapeHtml(unsafe: string): string {
        if (!unsafe) {
            return '';
        }
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static escapeRegex(string: string) {
        return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    static joinLast(array: (string | number)[], separator: string | undefined, lastSeparator: string | undefined): string {
        array = array.slice();
        const last = array.pop();
        if (last === undefined) {
            return '';
        }
        if (array.length === 0) {
            return last + '';
        }
        return array.join(separator) + lastSeparator + last;
    }

    static ordinalNumber(number: number): string {
        if (number === 1) {
            return $t('2e8a79b3-6393-4ce7-87bf-f293ec1b1f83');
        }

        if (number === 2) {
            return $t('feb4d546-e2b2-4b2c-ba14-6303ae9e0769');
        }

        if (number === 3) {
            return $t('e8962830-bc23-4af4-9909-d665a37f805d');
        }

        return $t('8abddd1b-0359-42fa-ab4d-707f39d84852', { number: number.toString() });
    }

    static pluralText(num: number, singular: StringLike, plural: StringLike): string {
        if (num === 1) {
            return $t('77477737-3b6b-4e1b-9fd8-006981cf53eb', { singular });
        }

        return this.float(num) + ' ' + plural;
    }

    static groupNamesByFamily(names: { firstName: string; lastName: string }[]): string {
        const n = names.slice().sort((a, b) => Sorter.stack(a.lastName.localeCompare(b.lastName), a.firstName.localeCompare(b.firstName)));
        const firstNames = this.uniqueArray(n.map(n => n.firstName));
        const lastNames = this.uniqueArray(n.map(n => n.lastName));

        return this.joinLast(firstNames, ', ', ' ' + $t('6a156458-b396-4d0f-b562-adb3e38fc51b') + ' ') + (lastNames.length > 0 ? (' ' + lastNames.join('-')) : '');
    }

    static firstLetters(str: StringLike, maxLength: number) {
        if (!str) {
            return '';
        }
        if (maxLength === 1) {
            return str.substr(0, 1).toLocaleUpperCase();
        }

        const splitted = Formatter.slug(str).split('-');
        return splitted.slice(0, maxLength).map(s => s.substr(0, 1).toLocaleUpperCase()).join('');
    }

    static injectPattern(value: string, parts: (string | { length: number })[]) {
        let result = '';
        for (const part of parts) {
            if (typeof part === 'string') {
                result += part;
                continue;
            }
            result += value.substring(0, part.length);
            value = value.substring(part.length);

            if (value.length === 0) {
                break;
            }
        }

        return result;
    }
}
