<template>
    <div class="container graph">
        <h2 class="style-with-button">
            <span>{{ title }}</span>
            <GraphDateRangeSelector v-if="options === null || options.length > 1" v-model="range" :options="options" />
        </h2>
        <p class="style-price-big">
            {{ loading ? '-' : format(lastValue) }}
        </p>
        <div class="canvas-box">
            <canvas v-once ref="canvas" />
            <Spinner v-if="loading" />
        </div>
    </div>
</template>

<script lang="ts">
import { Spinner, STNavigationBar, Toast } from "@stamhoofd/components";
import { Graph } from "@stamhoofd/structures";
import {
    CategoryScale,
    Chart, Filler, LinearScale,
    LineController,
    LineElement, PointElement, RadarController, Tooltip
} from 'chart.js';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import { DateOption } from "./DateRange";
import GraphDateRangeSelector from "./GraphDateRangeSelector.vue";

@Component({
    components: {
        STNavigationBar,
        GraphDateRangeSelector,
        Spinner
    }
})
export default class GraphView extends  Vue {
    @Prop({ default: false })
    sum: boolean

    @Prop({ default: null })
    formatter: ((value: number) => string) | null

    @Prop({ required: true })
    title: string

    @Prop({ required: true })
    load: (range: DateOption) => Promise<Graph>

    @Prop({ required: true, default: null })
    options!: DateOption[] | null
    
    range = this.options ? this.options[0] : null;
    chart: Chart
    loading = true

    graphData: Graph | null = null

    mounted() {
        this.loadData().catch(console.error) 
    }

    @Watch('options')
    onChangeOptions(n, old) {
        if (old === null) {
            this.range = n[0]
        }
    }

    @Watch('range')
    onChangeRange() {
        this.loadData().catch(console.error) 
    }

    async loadData() {
        if (!this.options) {
            return
        }
        if (!this.range) {
            // should happen in watcher
            return;
        }

        this.loading = true
        try {
            this.graphData = await this.load(this.range)
            this.loadGraph(this.graphData)
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }

        this.loading = false
    }

    format(v: number) {
        if (this.formatter) {
            return this.formatter(v)
        }
        return v + ""
    }

    get lastValue(): number {
        if (!this.graphData) {
            return 0
        }
        if (this.sum) {
            let v = 0;
            for (const d of this.graphData.data[0].values) {
                v += d
            }

            return v
        }
        const d = this.graphData.data[0]
        return d.values[d.values.length - 1]
    }

    loadGraph(graph: Graph) {
        if (!this.chart) {
            Chart.register(
                LineElement,
                PointElement,
                LineController,
                RadarController,
                CategoryScale,
                LinearScale,
                //Decimation,
                Filler,
                Tooltip
            );
        } else {
            this.chart.destroy()
        }

        let width, height, gradient;
        function getBorderGradient(ctx, chartArea) {
            const chartWidth = chartArea.right - chartArea.left;
            const chartHeight = chartArea.bottom - chartArea.top;
            if (!gradient || width !== chartWidth || height !== chartHeight) {
                // Create the gradient because this is either the first render
                // or the size of the chart has changed
                width = chartWidth;
                height = chartHeight;
                gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                gradient.addColorStop(0, '#0053ff');
                gradient.addColorStop(1, "#8B17FF");
            }

            return gradient;
        }

        let width2, height2, gradient2;
        function getBackgroundGradient(ctx, chartArea) {
            const chartWidth = chartArea.right - chartArea.left;
            const chartHeight = chartArea.bottom - chartArea.top;
            if (!gradient || width2 !== chartWidth || height2 !== chartHeight) {
                // Create the gradient because this is either the first render
                // or the size of the chart has changed
                width2 = chartWidth;
                height2 = chartHeight;
                gradient2 = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                gradient2.addColorStop(0, '#0053ff20');
                gradient2.addColorStop(1, "#8B17FF10");
            }

            return gradient2;
        }

        const fontFamily = `Metropolis, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;
        
        this.chart = new Chart(this.$refs.canvas as HTMLCanvasElement, {
            type: 'line',
            data: {
                labels: graph.labels,
                datasets: graph.data.map(d => {
                    return {
                        label: d.label,
                        data: d.values,
                        cubicInterpolationMode: 'monotone',
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;

                            if (!chartArea) {
                            // This case happens on initial chart load
                                return;
                            }
                            return getBackgroundGradient(ctx, chartArea);
                        },
                        borderColor: function(context) {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;

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
                        borderJoinStyle: 'miter',
                        pointBackgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;

                            if (!chartArea) {
                            // This case happens on initial chart load
                                return;
                            }
                            return getBorderGradient(ctx, chartArea);
                        }
                    }
                })
            },
            options: {
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        bottom: 10,
                        top: 10,
                        left: 10,
                        right: 10
                    },
                },
                scales: {
                    y: {
                        display: false,
                        stacked: false,
                        beginAtZero: true,
                        suggestedMax: 100,
                        position: {
                            x: -50,
                        },
                        ticks: {
                            display: false
                        },
                        
                        grid: {
                            display: false
                        }
                    },
                    x: {
                        //display: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            borderColor: "rgba(0, 0, 0, 0)",
                            tickColor: 'red',
                            display: false,
                        },
                        ticks: {
                            display: true,
                            align: 'inner',
                            font: {
                                size: 13,
                                family: fontFamily
                            },
                            // Include a dollar sign in the ticks
                            callback: function(value, index, ticks) {
                                if (index === 0 || index === ticks.length - 1) {
                                    return this.getLabelForValue(value as any as number)
                                }
                                return undefined;
                            }
                        }
                    }
                },
                // Hide horizontal lines

                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        padding: 15,
                        cornerRadius: 7,
                        caretSize: 0,
                        bodyFont: {
                            family: fontFamily,
                            weight: '400',
                            size: 13
                        },
                        titleFont: {
                            family: fontFamily,
                            weight: '600',
                            size: 14
                        },
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                return this.format(context.parsed.y as number)
                            }
                        }
                    },
                },
                elements: {
                    point:{
                        radius: 0,
                        hoverRadius: 5,
                        hitRadius: 50,
                        borderWidth: 0,
                        hoverBorderWidth: 0
                    }
                }
            }
        });
    }
}
</script>

<style scoped lang="scss">

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
