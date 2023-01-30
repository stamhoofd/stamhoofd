import { DateTime } from "luxon";

import { Sorter } from "./Sorter";

 function pad(number) {
    if (number < 10) {
        return '0' + number;
    }
    return number;
}

export class Formatter {
    static timezone = "Europe/Brussels"

    static removeAccents(name: string): string {
        name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return name
    }

    static slug(name: string): string {
        return this.removeAccents(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").replace(/-+$/, "")
    }

    static slugEmail(name: string): string {
        return this.removeAccents(name).toLowerCase().replace(/[^a-z0-9_]+/g, "-").replace(/^-+/, "").replace(/-+$/, "")
    }

    static fileSlug(name: string): string {
        return this.removeAccents(name).replace(/[^A-Za-z0-9-]+/g, " ").trim()
    }

    /**
     * 1 = january
     */
    static month(index: number): string {
        const monthNames = ["januari", "februari", "maart", "april", "mei", "juni",
            "juli", "augustus", "september", "oktober", "november", "december"
        ];
        return monthNames[index - 1]
    }

    static weekDay(date: Date): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return "?"
        }
        const monthNames = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag", ]

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return monthNames[datetime.weekday - 1];
    }

    /**
     * 1 januari (2020). Year only in different year if withYear is null (default)
     */
    static date(date: Date, withYear: boolean | null = null): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return "?"
        }
        const currentYear = DateTime.now().setZone(this.timezone).year;

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        const year = datetime.year;
        return datetime.day + " " + this.month(datetime.month) + (currentYear != year || withYear === true ? (" "+year) : "")
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

    /**
     * maandag, 1 januari (2020). Year only in different year
     */
    static dateWithDay(date: Date): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return "?"
        }
        return this.weekDay(date) +", "+this.date(date)
    }

    /**
     * maandag, 1 januari (2020) om XX:XX. Year only in different year
     */
    static dateTimeWithDay(date: Date): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return "?"
        }
        return this.weekDay(date) +", "+this.dateTime(date)
    }


     /**
     * 01/01/2020
     */
    static dateNumber(date: Date, withYear = true): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return "?"
        }

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return (datetime.day+"").padStart(2, "0") + "/" + (datetime.month+"").padStart(2, "0") + (withYear ? "/"+datetime.year : "")
    }

    /**
     * 2020-01-31
     */
    static dateIso(date: Date): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return "?"
        }

        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        const year = datetime.year
        return year+"-"+(datetime.month+"").padStart(2, "0")+"-"+(datetime.day+"").padStart(2, "0")
    }

    /**
     * 12:00
     */
    static time(date: Date): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return "?"
        }
        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return datetime.hour+":"+(datetime.minute+"").padStart(2, "0")
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
            return "?"
        }
        const datetime = DateTime.fromJSDate(date).setZone(this.timezone);
        return (datetime.hour+"").padStart(2, "0")+":"+(datetime.minute+"").padStart(2, "0")
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
    static dateTime(date: Date, hideZero = false): string {
        if (!date) {
            // Crash protection in case undefined get passed
            return "?"
        }
        if (hideZero && this.time(date) == "0:00") {
            return this.date(date)
        }
        return this.date(date) + " om "+this.time(date)
    }

    static price(value: number, removeZeroDecimals = true): string {
        const formatted = new Intl.NumberFormat("nl-BE", {
            style: "currency",
            currency: "EUR",
        }).format(Math.abs(value) / 100);

        const v = (value < 0 ? "- " : "")+formatted.replace(new RegExp("EUR", "ig"), '€');
        if (removeZeroDecimals && (v.endsWith(",00") || v.endsWith(".00"))) {
            return v.substring(0, v.length-3)
        }

        return v;
    }

    static priceChange(value: number): string {
        if (value >= 0) {
            return "+ "+this.price(value)
        }
        return this.price(value)
    }

    static capitalizeFirstLetter(string: string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    static capitalizeWords(string: string) {
        return string.split(" ").map(s => this.capitalizeFirstLetter(s)).join(" ")
    }

    static fileSize(bytes: number) {
        if (bytes < 1000) {
            return bytes+" bytes"
        }

        if (bytes < 1000*1000) {
            return Math.round(bytes/1000) + " kB"
        }

        if (bytes < 1000 * 1000 * 1000) {
            return Math.round(bytes / 1000 / 100)/10 + " MB"
        }

        return Math.round(bytes / 1000 / 1000 / 10) / 100 + " GB"
    }

    static minutesPadded(minutes: number): string {
        const h = Math.floor(minutes/60)
        const m = minutes - h*60
        return (h+"").padStart(2, "0")+":"+(m+"").padStart(2, "0")
    }

    static minutes(minutes: number): string {
        const h = Math.floor(minutes/60)
        const m = minutes - h*60
        return h+":"+(m+"").padStart(2, "0")
    }

    static escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    static joinLast(array: (string | number)[], separator: string | undefined, lastSeparator: string | undefined): string {
        array = array.slice()
        const last = array.pop()
        if (last === undefined) {
            return ""
        }
        if (array.length == 0) {
            return last+""
        }
        return array.join(separator)+lastSeparator+last
    }

    static ordinalNumber(number: number): string {
        if (number == 1) {
            return "eerste"
        }

        if (number == 2) {
            return "tweede"
        }

        if (number == 3) {
            return "derde"
        }

        return number+"e"
    }

    static groupNamesByFamily(names: {firstName: string, lastName: string}[]): string {
        const n = names.slice().sort((a, b) => Sorter.stack(a.lastName.localeCompare(b.lastName), a.firstName.localeCompare(b.firstName)));
        const firstNames = this.uniqueArray(n.map(n => n.firstName))
        const lastNames = this.uniqueArray(n.map(n => n.lastName))

        return this.joinLast(firstNames, ", ", " en ") + (lastNames.length > 0 ? (" " + lastNames.join('-')) : '');
    }

    static firstLetters(str: string, maxLength: number) {
        if (maxLength === 1) {
            return str.substr(0, 1).toLocaleUpperCase()
        }

        const splitted = Formatter.slug(str).split('-')
        return splitted.slice(0, maxLength).map(s => s.substr(0, 1).toLocaleUpperCase()).join('')
    }
}