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

<script lang="ts">
import { ContextMenu, ContextMenuItem, Spinner, STNavigationBar, Toast } from "@stamhoofd/components";
import { Graph } from "@stamhoofd/structures";
import {
    CategoryScale,
    Chart, Filler, LinearScale,
    LineController,
    LineElement, PointElement, Tooltip
} from 'chart.js';
import { Component, Prop, Vue, Watch } from "@simonbackx/vue-app-navigation/classes";

import { DateOption } from "./DateRange";
import GraphDateRangeSelector from "./GraphDateRangeSelector.vue";
import { GraphViewConfiguration } from "./GraphViewConfiguration";

@Component({
    components: {
        STNavigationBar,
        GraphDateRangeSelector,
        Spinner
    }
})
export default class GraphView extends  Vue {
    @Prop({ required: true }) 
    configurations!: GraphViewConfiguration[][]

    selectedConfiguration = this.configurations[0][0]

    get sum() {
        return this.selectedConfiguration.sum
    }

    get formatter() {
        return this.selectedConfiguration.formatter
    }

    get title() {
        return this.selectedConfiguration.title
    }

    async load(range: DateOption): Promise<Graph> {
        return await this.selectedConfiguration.load(range)
    }

    get options() {
        return this.selectedConfiguration.options
    }
    
    get range() {
        return this.selectedConfiguration.selectedRange
    }

    set range(range: DateOption | null) {
        this.selectedConfiguration.selectedRange = range
    }

    chart: Chart
    loading = true

    graphData: Graph | null = null

    mounted() {
        if (this.selectedConfiguration && this.options) {
            this.range = this.options[0];
        }
        this.loadData().catch(console.error) 
    }

    get hasMultipleConfigurations() {
        return this.configurations.length || this.configurations.find(c => c.length)
    }

    chooseConfiguration(event) {
        const contextMenu = new ContextMenu(
            this.configurations.map(arr => {
                return arr.map(config => {
                    return new ContextMenuItem({
                        name: config.title,
                        action: () => {
                            this.selectedConfiguration = config
                            return true;
                        }
                    })
                })
            })
        );
        contextMenu.show({ button: event.currentTarget, xPlacement: "right" }).catch(console.error);
    }

    @Watch('options')
    onChangeOptions(n) {
        this.range = n[0]
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
        let update = false
        if (!this.chart) {
            Chart.register(
                LineElement,
                PointElement,
                LineController,
                CategoryScale,
                LinearScale,
                Filler,
                Tooltip
            );
        } else {
            //this.chart.destroy()
            update = true;
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
        
        const options = {
            maintainAspectRatio: false,
            layout: {
                padding: {
                    bottom: 10,
                    top: 5,
                    left: 10,
                    right: 10
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
                        display: false
                    },  
                    grid: {
                        display: false
                    }
                },
                x: {
                    //display: false,
                    grid: {
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
            elements: {
                point:{
                    radius: 0,
                    hoverRadius: 5,
                    hitRadius: 50,
                    borderWidth: 0,
                    hoverBorderWidth: 0
                }
            },
            plugins: {
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
            }
        };

        const datasets = graph.data.map(d => {
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
                borderJoinStyle: 'round',
                borderCapStyle: 'round',
                showLine: true,
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
        });

        if (update) {
            // Only update these values because they can animate
            this.chart.data.datasets[0].data! = datasets[0].data
            this.chart.data.datasets[0].label! = datasets[0].label
            this.chart.data.labels = graph.labels
            this.chart.update()
        } else {
            this.chart = new Chart(this.$refs.canvas as HTMLCanvasElement, {
                type: 'line',
                data: {
                    labels: graph.labels,
                    datasets: datasets as any
                },
                options: options as any
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
