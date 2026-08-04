<template>
    <GraphView :configurations="configurations" data-testid="breakdown-graph" />
</template>

<script lang="ts" setup>
import { DateOption } from '@stamhoofd/components/views/DateRange';
import GraphView from '@stamhoofd/components/views/GraphView.vue';
import { GraphViewConfiguration } from '@stamhoofd/components/views/GraphViewConfiguration';
import { Graph, GraphData } from '@stamhoofd/structures';
import type { BreakdownGraph, BreakdownGraphPoint } from '@stamhoofd/structures/PaymentBreakdown.js';
import { BreakdownGraphUnit } from '@stamhoofd/structures/PaymentBreakdown.js';
import { Formatter } from '@stamhoofd/utility';
import type { DurationLike } from 'luxon';
import { computed } from 'vue';

/**
 * What was received or charged over time. The periods that can be chosen follow the data: a selection
 * of three months doesn't offer to look at the last twelve.
 *
 * Only meant for a graph that holds something: a line through fewer than two points says nothing, so
 * there is nothing to draw and no period to choose.
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

const first = computed((): BreakdownGraphPoint | null => points.value[0] ?? null);
const last = computed((): BreakdownGraphPoint | null => points.value[points.value.length - 1] ?? null);

/**
 * The end of the last day or week that was measured: everything that was measured falls before it.
 */
const end = computed(() => {
    const date = last.value?.date ?? new Date();
    return Formatter.luxon(date).endOf(isWeekly.value ? 'week' : 'day').toJSDate();
});

const start = computed(() => first.value?.date ?? end.value);

const periods: { name: string; duration: DurationLike }[] = [
    { name: $t('%Zjp'), duration: { weeks: 1 } },
    { name: $t('%Zio'), duration: { months: 1 } },
    { name: $t('%Zib'), duration: { months: 6 } },
    { name: $t('%Zie'), duration: { months: 12 } },
];

function pointsIn(range: { start: Date; end: Date }): BreakdownGraphPoint[] {
    return points.value.filter(point => point.date >= range.start && point.date <= range.end);
}

/**
 * Everything that was measured, plus the shorter periods that leave out a part of it and still hold
 * enough to draw a line.
 */
const rangeOptions = computed(() => {
    const options = [new DateOption($t('%ZiU'), { start: start.value, end: end.value })];

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

    return $t('%ZjI', { date: Formatter.date(point.date, true) });
}

const configurations = computed(() => [[
    new GraphViewConfiguration({
        title: props.title,
        options: rangeOptions.value,
        selectedRange: rangeOptions.value[0],
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
