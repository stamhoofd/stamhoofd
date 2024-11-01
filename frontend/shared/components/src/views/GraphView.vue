<template>
    <div class="container graph">
        <h2 class="style-with-button">
            <button class="button style-label" type="button" @click="chooseConfiguration">
                <span class="">{{ title }}</span>
                <span v-if="hasMultipleConfigurations" class="icon arrow-down-small" />
                <span v-else class="icon empty" />
            </button>

            <div>
                <GraphDateRangeSelector v-if="options === null || options.length > 1" v-model="range" :options="options" />
            </div>
        </h2>
        <p class="style-statistic">
            {{ loading ? '-' : format(lastValue) }}
        </p>
        <div class="canvas-box">
            <canvas v-once ref="canvas" />
            <Spinner v-if="loading" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ContextMenu, ContextMenuItem, Spinner, Toast } from '@stamhoofd/components';
import { Graph } from '@stamhoofd/structures';
import {
    CategoryScale,
    Chart, ChartArea, ChartDataset, ChartOptions, Filler, LinearScale,
    LineController,
    LineElement, PointElement, Tooltip,
} from 'chart.js';

import { computed, ComputedRef, ref, Ref, watch, WritableComputedRef } from 'vue';
import { DateOption } from './DateRange';
import GraphDateRangeSelector from './GraphDateRangeSelector.vue';
import { GraphViewConfiguration } from './GraphViewConfiguration';

const props = defineProps<{
    configurations: GraphViewConfiguration[][];
}>();

const defaultConfiguration = props.configurations[0][0];
const canvas = ref<HTMLCanvasElement | null>(null);
const selectedConfiguration = ref(defaultConfiguration) as Ref<GraphViewConfiguration>;

const sum = computed(() => selectedConfiguration.value.sum);
const formatter = computed(() => selectedConfiguration.value.formatter);
const title = computed(() => selectedConfiguration.value.title);
const options = computed(() => selectedConfiguration.value.options) as ComputedRef<DateOption[] | null>;
const range = computed<DateOption | null>({
    get: () => selectedConfiguration.value.selectedRange,
    set: (range: DateOption | null) => {
        selectedConfiguration.value.selectRange(range);
    },
}) as WritableComputedRef<DateOption | null>;

const hasMultipleConfigurations = computed(() => props.configurations.length || props.configurations.find(c => c.length));
const loading = ref(false);
let chart: Chart;
const graphData = ref<Graph | null>(null);

watch(range, async (range: DateOption | null) => {
    if (range) {
        await loadData();
    }
}, { immediate: true });

function setSelectedRangeOnConfiguration(config: GraphViewConfiguration, oldConfig: GraphViewConfiguration | undefined | null) {
    const oldRangeValue = oldConfig?.selectedRange?.range;
    const newOptions = config.options;

    let equalRange: DateOption | undefined = undefined;

    /**
     * Check if the configuration contains an option with the same date range as
     * the current selected range.
     */
    if (oldRangeValue) {
        equalRange = newOptions?.find(option => option.equals(oldRangeValue));
    }

    /**
     * Set default selected range.
     */
    config.selectedRange = equalRange ?? config.selectedRange ?? newOptions?.[0] ?? null;
}

function chooseConfiguration(event: MouseEvent) {
    const contextMenu = new ContextMenu(
        props.configurations.map((arr) => {
            return arr.map((config) => {
                return new ContextMenuItem({
                    name: config.title,
                    action: () => {
                        setSelectedRangeOnConfiguration(config, selectedConfiguration.value);
                        selectedConfiguration.value = config;
                        return true;
                    },
                });
            });
        }),
    );
    contextMenu.show({ button: event.currentTarget as HTMLElement, xPlacement: 'right' }).catch(console.error);
}

async function loadData() {
    const configuration = selectedConfiguration.value;
    if (!configuration.selectedRange) {
        console.error('Cannot load graph, no range selected.');
        return;
    }

    loading.value = true;
    try {
        const newGraphData = await configuration.load(configuration.selectedRange);
        graphData.value = newGraphData;
        loadGraph(newGraphData);
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }

    loading.value = false;
}

function format(v: number) {
    if (formatter.value) {
        return formatter.value(v);
    }
    return v + '';
}

const lastValue = computed(() => {
    if (!graphData.value) {
        return 0;
    }
    if (sum.value) {
        let v = 0;
        for (const d of graphData.value.data[0].values) {
            v += d;
        }

        return v;
    }
    const d = graphData.value.data[0];
    return d.values[d.values.length - 1];
});

function loadGraph(graph: Graph) {
    let update = false;
    if (!chart) {
        Chart.register(
            LineElement,
            PointElement,
            LineController,
            CategoryScale,
            LinearScale,
            Filler,
            Tooltip,
        );
    }
    else {
        // chart.destroy()
        update = true;
    }

    let width: number, height: number, gradient: CanvasGradient;
    function getBorderGradient(ctx: CanvasRenderingContext2D, chartArea: ChartArea) {
        const chartWidth = chartArea.right - chartArea.left;
        const chartHeight = chartArea.bottom - chartArea.top;
        if (!gradient || width !== chartWidth || height !== chartHeight) {
            // Create the gradient because this is either the first render
            // or the size of the chart has changed
            width = chartWidth;
            height = chartHeight;
            gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
            gradient.addColorStop(0, '#0053ff');
            gradient.addColorStop(1, '#8B17FF');
        }

        return gradient;
    }

    let width2: number, height2: number, gradient2: CanvasGradient;
    function getBackgroundGradient(ctx: CanvasRenderingContext2D, chartArea: ChartArea) {
        const chartWidth = chartArea.right - chartArea.left;
        const chartHeight = chartArea.bottom - chartArea.top;
        if (!gradient || width2 !== chartWidth || height2 !== chartHeight) {
            // Create the gradient because this is either the first render
            // or the size of the chart has changed
            width2 = chartWidth;
            height2 = chartHeight;
            gradient2 = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
            gradient2.addColorStop(0, '#0053ff20');
            gradient2.addColorStop(1, '#8B17FF10');
        }

        return gradient2;
    }

    const fontFamily = `Metropolis, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;

    const options: ChartOptions = {
        maintainAspectRatio: false,
        layout: {
            padding: {
                bottom: 10,
                top: 5,
                left: 10,
                right: 10,
            },
        },
        scales: {
            y: {
                display: false,
                beginAtZero: true,
                suggestedMax: 1,
                position: {
                    x: -50,
                },
                ticks: {
                    display: false,
                },
                grid: {
                    display: false,
                },
            },
            x: {
                // display: false,
                grid: {
                    display: false,
                },
                ticks: {
                    display: true,
                    align: 'inner',
                    font: {
                        size: 13,
                        family: fontFamily,
                    },
                    // Include a dollar sign in the ticks
                    callback: function (value, index, ticks) {
                        if (index === 0 || index === ticks.length - 1) {
                            return this.getLabelForValue(value as any as number);
                        }
                        return undefined;
                    },
                },
            },
        },
        elements: {
            point: {
                radius: 0,
                hoverRadius: 5,
                hitRadius: 50,
                borderWidth: 0,
                hoverBorderWidth: 0,
            },
        },
        plugins: {
            tooltip: {
                padding: 15,
                cornerRadius: 7,
                caretSize: 0,
                bodyFont: {
                    family: fontFamily,
                    weight: '400',
                    size: 13,
                },
                titleFont: {
                    family: fontFamily,
                    weight: '600',
                    size: 14,
                },
                displayColors: false,
                callbacks: {
                    label: (context) => {
                        return format(context.parsed.y as number);
                    },
                },
            },
        },
    };

    const datasets = graph.data.map((d) => {
        const dataSet: ChartDataset = {
            label: d.label,
            data: d.values,
            cubicInterpolationMode: 'monotone',
            backgroundColor: function (context: { chart: Chart }) {
                const chart = context.chart;
                const { ctx, chartArea } = chart;

                if (!chartArea) {
                    // This case happens on initial chart load
                    return;
                }
                return getBackgroundGradient(ctx, chartArea);
            },
            borderColor: function (context: { chart: Chart }) {
                const chart = context.chart;
                const { ctx, chartArea } = chart;

                if (!chartArea) {
                    // This case happens on initial chart load
                    return;
                }
                return getBorderGradient(ctx, chartArea);
            },
            fill: true,
            borderWidth: 3,
            tension: 1,
            clip: false,
            borderJoinStyle: 'round',
            borderCapStyle: 'round',
            showLine: true,
            pointBackgroundColor: function (context: { chart: Chart }) {
                const chart = context.chart;
                const { ctx, chartArea } = chart;

                if (!chartArea) {
                    // This case happens on initial chart load
                    return;
                }
                return getBorderGradient(ctx, chartArea);
            },
        };

        return dataSet;
    });

    if (update) {
        // Only update these values because they can animate
        chart.data.datasets[0].data! = datasets[0].data;
        chart.data.datasets[0].label! = datasets[0].label ?? '';
        chart.data.labels = graph.labels;
        chart.update();
    }
    else {
        if (canvas.value === null) {
            console.error('Canvas is null');
        }
        else {
            chart = new Chart(canvas.value, {
                type: 'line',
                data: {
                    labels: graph.labels,
                    datasets: datasets as any,
                },
                options: options as any,
            });
        }
    }
}
</script>

<style scoped lang="scss">

.graph {
    h2.style-with-button > *:first-child{
        padding-bottom: 5px !important;
    }
}
.canvas-box {
    position: relative;
    width: 100%;
    height: 500px;
    max-height: 30vh;

    .spinner-container {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
    }
}
</style>
