import { DateTime } from 'luxon';

import { Sorter } from './Sorter';

export class Formatter {
    static timezone = 'Europe/Brussels';

    static removeAccents(name: string): string {
        name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name;
    }

    static emailSenderName(name: string): string {
        return this.removeAccents(name).replace(/[^A-Za-z]+/g, ' ').trim();
    }

    static slug(name: string): string {
        return this.removeAccents(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    }

    static slugEmail(name: string): string {
        return this.removeAccents(name).toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    }

    static fileSlug(name: string): string {
        return this.removeAccents(name).replace(/[^A-Za-z0-9-]+/g, ' ').trim();
    }

    static removeDuplicateSpaces(name: string): string {
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
        const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
            'juli', 'augustus', 'september', 'oktober', 'november', 'december',
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
        const monthNames = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return monthNames[datetime.weekday - 1];
    }

    /**
     * 1 januari (2020). Year only in different year if withYear is null (default)
     */
    static date(date: Date, withYear: boolean | null = null): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        const currentYear = DateTime.now().setZone(this.timezone).year;

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        const year = datetime.year;
        return datetime.day + ' ' + this.month(datetime.month) + (currentYear !== year || withYear === true ? (' ' + year) : '');
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
                return 'één dag geleden';
            }
            return days + ' dagen geleden';
        }

        if (hours > 0) {
            if (options?.hours === false) {
                return this.dateTime(date, true, true);
            }

            if (hours === 1) {
                return 'één uur geleden';
            }
            return hours + ' uur geleden';
        }

        if (minutes > 0) {
            if (minutes === 1) {
                return 'één minuut geleden';
            }
            return minutes + ' minuten geleden';
        }

        const seconds = Math.floor(diff / 1000);
        if (seconds > 0) {
            if (seconds === 1) {
                return 'één seconde geleden';
            }
            return seconds + ' seconden geleden';
        }

        return 'zojuist';
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
    static dateWithDay(date: Date, withYear = false): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        return this.weekDay(date) + ', ' + this.date(date, withYear);
    }

    /**
     * maandag, 1 januari (2020) om XX:XX. Year only in different year
     */
    static dateTimeWithDay(date: Date, hideZero = false, withYear = false): string {
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

    static startDate(startDate: Date, includeDay = false, withYear = false): string {
        if (Formatter.time(startDate) === '0:00') {
            if (includeDay) {
                return Formatter.dateWithDay(startDate, withYear);
            }
            return Formatter.date(startDate, withYear);
        }

        if (includeDay) {
            return Formatter.dateTimeWithDay(startDate, withYear);
        }
        return Formatter.dateTime(startDate, withYear);
    }

    static endDate(endDate: Date, includeDay = false, withYear = false): string {
        if (Formatter.time(endDate) === '23:59') {
            if (includeDay) {
                return Formatter.dateWithDay(endDate, withYear);
            }
            return Formatter.date(endDate, withYear);
        }

        if (includeDay) {
            return Formatter.dateTimeWithDay(endDate, withYear);
        }
        return Formatter.dateTime(endDate, false, withYear);
    }

    static dateRange(startDate: Date, endDate: Date, join = ' - '): string {
        if (Formatter.dateIso(startDate) === Formatter.dateIso(endDate)) {
            if (Formatter.time(startDate) === Formatter.time(endDate)) {
                return Formatter.dateWithDay(startDate) + ', ' + Formatter.time(startDate);
            }

            if (Formatter.time(startDate) === '0:00' && Formatter.time(endDate) === '23:59') {
                return Formatter.dateWithDay(startDate);
            }

            return Formatter.dateWithDay(startDate) + ', ' + Formatter.time(startDate) + join + Formatter.time(endDate);
        }

        // If start in evening and end on the next morning: only mention date once
        if (Formatter.dateIso(startDate) === Formatter.dateIso(new Date(endDate.getTime() - 24 * 60 * 60 * 1000)) && Formatter.timeIso(endDate) <= '07:00' && Formatter.timeIso(startDate) >= '12:00') {
            return Formatter.dateWithDay(startDate) + ', ' + Formatter.time(startDate) + join + Formatter.time(endDate);
        }

        const differentYear = Formatter.year(startDate) !== Formatter.year(endDate);
        return Formatter.startDate(startDate, false, differentYear) + join + Formatter.endDate(endDate, false, differentYear);
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
    static dateTime(date: Date, hideZero = false, withYear = false): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return '?';
        }
        if (hideZero && this.time(date) === '0:00') {
            return this.date(date, withYear);
        }
        return this.date(date, withYear) + ' om ' + this.time(date);
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
        }).format(Math.abs(value) / 100);

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

    static capitalizeFirstLetter(string: string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    static capitalizeWords(string: string) {
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
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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
            return 'eerste';
        }

        if (number === 2) {
            return 'tweede';
        }

        if (number === 3) {
            return 'derde';
        }

        return number + 'e';
    }

    static pluralText(num: number, singular: string, plural: string): string {
        if (num === 1) {
            return 'één ' + singular;
        }

        return num + ' ' + plural;
    }

    static groupNamesByFamily(names: { firstName: string; lastName: string }[]): string {
        const n = names.slice().sort((a, b) => Sorter.stack(a.lastName.localeCompare(b.lastName), a.firstName.localeCompare(b.firstName)));
        const firstNames = this.uniqueArray(n.map(n => n.firstName));
        const lastNames = this.uniqueArray(n.map(n => n.lastName));

        return this.joinLast(firstNames, ', ', ' en ') + (lastNames.length > 0 ? (' ' + lastNames.join('-')) : '');
    }

    static firstLetters(str: string, maxLength: number) {
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
