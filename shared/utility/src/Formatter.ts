 function pad(number) {
    if (number < 10) {
        return '0' + number;
    }
    return number;
}

export class Formatter {
    static slug(name: string): string {
        name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").replace(/-+$/, "")
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
        const monthNames = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"]
        return monthNames[date.getDay()]
    }

    /**
     * 1 januari (2020). Year only in different year
     */
    static date(date: Date): string {
        const currentYear = new Date().getFullYear()
        const year = date.getFullYear()
        return date.getDate() + " " + this.month(date.getMonth() + 1) + (currentYear != year ? (" "+year) : "")
    }

    /**
     * maandag, 1 januari (2020). Year only in different year
     */
    static dateWithDay(date: Date): string {
        return this.weekDay(date) +", "+this.date(date)
    }

    /**
     * maandag, 1 januari (2020). Year only in different year
     */
    static dateTimeWithDay(date: Date): string {
        return this.weekDay(date) +", "+this.dateTime(date)
    }


     /**
     * 01/01/2020
     */
    static dateNumber(date: Date): string {
        const year = date.getFullYear()
        return (date.getDate()+"").padStart(2, "0") + "/" + ((date.getMonth() + 1)+"").padStart(2, "0") + "/"+year
    }

    /**
     * 2020-01-31
     */
    static dateIso(date: Date): string {
        const year = date.getFullYear()
        return year+"-"+((date.getMonth() + 1)+"").padStart(2, "0")+"-"+(date.getDate()+"").padStart(2, "0")
    }

    /**
     * 12:00
     */
    static time(date: Date): string {
        return date.getHours()+":"+(date.getMinutes()+"").padStart(2, "0")
    }

    /**
     * 1 januari (2020) om 12:00. Year only in different year
     */
    static dateTime(date: Date): string {
        return this.date(date) + " om "+this.time(date)
    }

    static price(value: number): string {
        const formatted = new Intl.NumberFormat("nl-BE", {
            style: "currency",
            currency: "EUR",
        }).format(Math.abs(value) / 100);

        return formatted.replace(new RegExp("EUR", "ig"), '€');
    }

    static priceChange(value: number): string {
        if (value >= 0) {
            return "+ "+this.price(value)
        }
        return "- "+this.price(-value)
    }

    static capitalizeFirstLetter(string: string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
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
}