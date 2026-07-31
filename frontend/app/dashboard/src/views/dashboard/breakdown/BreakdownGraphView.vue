<template>
    <GraphView :configurations="configurations" data-testid="breakdown-graph" />
</template>

<script lang="ts" setup>
import { DateOption } from '@stamhoofd/components/views/DateRange';
import GraphView from '@stamhoofd/components/views/GraphView.vue';
import { GraphViewConfiguration } from '@stamhoofd/components/views/GraphViewConfiguration';
import type { BreakdownGraph, BreakdownGraphPoint } from '@stamhoofd/structures';
import { BreakdownGraphUnit, Graph, GraphData } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { DurationLike } from 'luxon';
import { computed } from 'vue';

/**
 * What was received or charged over time. The periods that can be chosen follow the data: a selection
 * of three months doesn't offer to look at the last twelve.
 */
const props = defineProps<{
    graph: BreakdownGraph;
    /**
     * What the amounts are, e.g. 'Ontvangen'.
     */
    title: string;
}>();

const isWeekly = computed(() => props.graph.unit === BreakdownGraphUnit.Week);

/**
 * The days or weeks in which nothing happened are only added here: sending them along would repeat
 * what the dates already say.
 */
const points = computed(() => props.graph.filledPoints);

/**
 * The end of the last day or week that was measured: everything that was measured falls before it.
 */
const end = computed(() => {
    const last = points.value[points.value.length - 1];
    return Formatter.luxon(last.date).endOf(isWeekly.value ? 'week' : 'day').toJSDate();
});

const start = computed(() => points.value[0].date);

const periods: { name: string; duration: DurationLike }[] = [
    { name: $t('Laatste week'), duration: { weeks: 1 } },
    { name: $t('Laatste maand'), duration: { months: 1 } },
    { name: $t('Laatste 6 maanden'), duration: { months: 6 } },
    { name: $t('Laatste 12 maanden'), duration: { months: 12 } },
];

function pointsIn(range: { start: Date; end: Date }): BreakdownGraphPoint[] {
    return points.value.filter(point => point.date >= range.start && point.date <= range.end);
}

/**
 * Everything that was measured, plus the shorter periods that leave out a part of it and still hold
 * enough to draw a line.
 */
const options = computed(() => {
    const all = new DateOption($t('Volledige periode'), { start: start.value, end: end.value });
    const options = [all];

    for (const period of periods) {
        const range = { start: Formatter.luxon(end.value).minus(period.duration).toJSDate(), end: end.value };

        if (range.start <= start.value || pointsIn(range).length < 3) {
            continue;
        }

        options.push(new DateOption(period.name, range));
    }

    return options;
});

function getLabel(point: BreakdownGraphPoint): string {
    if (!isWeekly.value) {
        return Formatter.date(point.date, true);
    }

    return $t('Week van {date}', { date: Formatter.date(point.date, true) });
}

const configurations = computed(() => [[
    new GraphViewConfiguration({
        title: props.title,
        options: options.value,
        selectedRange: options.value[0],
        sum: true,
        formatter: (value: number) => Formatter.price(value),
        // Everything that is shown was already loaded with the breakdown itself
        load: (range: DateOption) => {
            const points = pointsIn(range.range);

            return Promise.resolve(Graph.create({
                labels: points.map(getLabel),
                data: [
                    GraphData.create({
                        label: props.title,
                        values: points.map(point => point.price),
                    }),
                ],
            }));
        },
    }),
]]);
</script>
