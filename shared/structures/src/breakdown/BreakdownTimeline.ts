import { Formatter, Sorter } from '@stamhoofd/utility';
import { BreakdownGraph, BreakdownGraphPoint, BreakdownGraphUnit } from '../PaymentBreakdown.js';

/**
 * Adds up what was received or charged per day, so it can be shown over time.
 *
 * Days are counted in the timezone of the app (see Formatter.luxon), so money that came in just before
 * midnight belongs to the day the user saw on the clock.
 */
export class BreakdownTimeline {
    private days = new Map<string, { date: Date; price: number }>();

    add(date: Date | null, price: number) {
        if (!date) {
            return;
        }

        const day = Formatter.luxon(date).startOf('day');
        const key = day.toISODate() ?? '';
        const existing = this.days.get(key);

        if (existing) {
            existing.price += price;
            return;
        }

        this.days.set(key, { date: day.toJSDate(), price });
    }

    build(): BreakdownGraph {
        // Oldest first: a graph reads from left to right
        const days = [...this.days.values()].sort((a, b) => Sorter.byDateValue(b.date, a.date));

        if (days.length === 0) {
            return BreakdownGraph.create({});
        }

        // A month of days is still readable, longer than that only weeks are
        const span = Formatter.luxon(days[days.length - 1].date).diff(Formatter.luxon(days[0].date), 'days').days;
        const unit = span > 31 ? BreakdownGraphUnit.Week : BreakdownGraphUnit.Day;

        const points = unit === BreakdownGraphUnit.Week ? groupByWeek(days) : days;

        // Only the days or weeks something happened: the empty ones in between say nothing that the
        // dates don't already say, so they are added again where the graph is drawn
        return BreakdownGraph.create({
            unit,
            points: points.map(point => BreakdownGraphPoint.create(point)),
        });
    }
}

/**
 * Adds up the days of the same week, which starts on a monday.
 */
function groupByWeek(days: { date: Date; price: number }[]): { date: Date; price: number }[] {
    const weeks = new Map<string, { date: Date; price: number }>();

    for (const day of days) {
        const week = Formatter.luxon(day.date).startOf('week');
        const key = week.toISODate() ?? '';
        const existing = weeks.get(key);

        if (existing) {
            existing.price += day.price;
            continue;
        }

        weeks.set(key, { date: week.toJSDate(), price: day.price });
    }

    return [...weeks.values()];
}
