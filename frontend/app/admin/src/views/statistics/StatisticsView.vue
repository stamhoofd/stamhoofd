<template>
    <div class="st-view statistics-view background">
        <STNavigationBar title="Statistieken">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
        </STNavigationBar>
    
        <main>
            <h1>Statistieken</h1>

            <hr>
            <div class="graph-grid">
                <GraphView :configurations="graphConfigurations" />
            </div>
            <!--<div class="graph-split">
                <AdminGraphView title="Omzet" type="Revenue" :formatter="priceFormatter()" :sum="true" />
                <AdminGraphView title="Omzet webshops" type="RevenueWebshops" :formatter="priceFormatter()" :sum="true" />

                <AdminGraphView title="Omzet ledenadmin" type="RevenueMembers" :formatter="priceFormatter()" :sum="true" />

                <AdminGraphView title="Omzet transacties" type="RevenueTransactions" :formatter="priceFormatter()" :sum="true" />


                <AdminGraphView title="Aantal verenigingen" type="Organizations" />

                <AdminGraphView title="Aantal webshops" type="WebshopCount" />
                <AdminGraphView title="Aantal leden" type="Members" />

                <AdminGraphView title="Aantal bestellingen" type="WebshopOrders" :sum="true" />
                <AdminGraphView title="Webshops omzet" type="WebshopRevenue" :formatter="priceFormatter()" :sum="true" />

                <AdminGraphView title="Aantal administrators actief" type="ActiveAdmins" />
            </div>-->
        </main>
    </div>
</template>


<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, DateOption, GraphView, GraphViewConfiguration,STNavigationBar } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Graph } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import { buildDateRangeOptions } from "../../classes/DateRangeBuilder";

@Component({
    components: {
        STNavigationBar,
        GraphView,
        BackButton
    }
})
export default class StatisticsView extends Mixins(NavigationMixin) {

    mounted() {
        UrlHelper.setUrl("/statistics")
        document.title = "Statistieken - Stamhoofd"
    }

    priceFormatter() {
        return Formatter.price.bind(Formatter)
    }

    graphConfigurations = [
        [
            new GraphViewConfiguration({
                title: 'Omzet',
                load: (range) => this.loadData(range, 'Revenue'),
                formatter: (value: number) => Formatter.price(value),
                sum: true,
                options: buildDateRangeOptions()
            }),
            new GraphViewConfiguration({
                title: 'Omzet webshops',
                load: (range) => this.loadData(range, 'RevenueWebshops'),
                formatter: (value: number) => Formatter.price(value),
                sum: true,
                options: buildDateRangeOptions()
            }),
            new GraphViewConfiguration({
                title: 'Omzet ledenadministratie',
                load: (range) => this.loadData(range, 'RevenueMembers'),
                formatter: (value: number) => Formatter.price(value),
                sum: true,
                options: buildDateRangeOptions()
            }),
            new GraphViewConfiguration({
                title: 'Omzet Buckaroo',
                load: (range) => this.loadData(range, 'RevenueTransactions'),
                formatter: (value: number) => Formatter.price(value),
                sum: true,
                options: buildDateRangeOptions()
            }),
            new GraphViewConfiguration({
                title: 'Omzet Stripe',
                load: (range) => this.loadData(range, 'RevenueStripe'),
                formatter: (value: number) => Formatter.price(value),
                sum: true,
                options: buildDateRangeOptions()
            })
        ],
        [
            new GraphViewConfiguration({
                title: 'Aantal verenigingen',
                load: (range) => this.loadData(range, 'Organizations'),
                formatter: (value: number) => value.toString(),
                sum: false,
                options: buildDateRangeOptions()
            }),
            new GraphViewConfiguration({
                title: 'Aantal webshops',
                load: (range) => this.loadData(range, 'WebshopCount'),
                formatter: (value: number) => value.toString(),
                sum: false,
                options: buildDateRangeOptions()
            }),
            new GraphViewConfiguration({
                title: 'Aantal leden',
                load: (range) => this.loadData(range, 'Members'),
                formatter: (value: number) => value.toString(),
                sum: false,
                options: buildDateRangeOptions()
            })
        ],
        [
            new GraphViewConfiguration({
                title: 'Aantal bestellingen',
                load: (range) => this.loadData(range, 'WebshopOrders'),
                formatter: (value: number) => value.toString(),
                sum: true,
                options: buildDateRangeOptions()
            }),
            new GraphViewConfiguration({
                title: 'Webshops omzet',
                load: (range) => this.loadData(range, 'WebshopRevenue'),
                formatter: (value: number) => Formatter.price(value),
                sum: true,
                options: buildDateRangeOptions()
            })
        ],
        [
            new GraphViewConfiguration({
                title: 'Aantal administrators actief',
                load: (range) => this.loadData(range, 'ActiveAdmins'),
                formatter: (value: number) => value.toString(),
                sum: false,
                options: buildDateRangeOptions()
            })
        ]
    ]

    async loadData(range: DateOption, type) {
        const response = await AdminSession.shared.authenticatedServer.request({
            method: "POST",
            path: "/statistics",
            body: {
                type,
                start: range.range.start.getTime(),
                end: range.range.end.getTime()
            },
            decoder: Graph as Decoder<Graph>
        })
        return response.data
    }
}
</script>


<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.statistics-view {
   .graph-split {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(500px, 1fr) );
       gap: 30px;

       @media (max-width: 1200px) {
            grid-template-columns: 1fr;
       }
   }
}
</style>
