export type DateRange = { start: Date; end: Date };

export class DateOption {
    name: string;
    range: DateRange;

    constructor(name: string, range: DateRange) {
        this.name = name;
        this.range = range;
    }

    equals(range: DateRange) {
        return this.range.start.getTime() === range.start.getTime() && this.range.end.getTime() === range.end.getTime();
    }
}
