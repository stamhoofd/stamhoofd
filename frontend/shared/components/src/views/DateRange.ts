export type DateRange = { start: Date, end: Date }

export class DateOption {
    name: string
    range: DateRange

    constructor(name: string, range: DateRange) {
        this.name = name
        this.range = range
    }

    equals(range: DateRange) {
        return this.range.start == range.start && this.range.end == range.end
    }
}