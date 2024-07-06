<template>
    <div class="st-menu st-view">
        <STNavigationBar title="Boekhouding" />

        <main>
            <h1>Boekhouding</h1>

            <div class="container">
                <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Invoices) }" @click="navigate(Routes.Invoices)">
                    <span class="icon file-filled" />
                    <span>
                        Facturen
                    </span>
                </button>

                <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.PendingInvoices) }" @click="navigate(Routes.PendingInvoices)">
                    <span class="icon clock" />
                    <span>
                        Openstaande bedragen
                    </span>
                </button>

                <hr>

                <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.ChargeMemberships) }" @click="navigate(Routes.ChargeMemberships)">
                    <span class="icon calculator" />
                    <span>
                        Aansluitingen aanrekenen
                    </span>
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { usePlatform } from '@stamhoofd/components';
import { ComponentOptions } from 'vue';
import OrganizationsTableView from '../organizations/OrganizationsTableView.vue';
import InvoicesTableView from './InvoicesTableView.vue';
import ChargeMembershipsView from './ChargeMembershipsView.vue';

enum Routes {
    Invoices = 'invoices',
    PendingInvoices = 'pendingInvoices',
    ChargeMemberships = 'chargeMemberships'
}

defineRoutes([
    {
        url: 'facturen',
        name: Routes.Invoices,
        show: 'detail',
        component: InvoicesTableView as unknown as ComponentOptions,
        isDefault: {
            properties: {}
        }
    },
    {
        url: 'openstaande-bedragen',
        name: Routes.PendingInvoices,
        show: 'detail',
        component: OrganizationsTableView as unknown as ComponentOptions,
        isDefault: {
            properties: {}
        }
    },
    {
        url: 'aansluitingen-aanrekenen',
        name: Routes.ChargeMemberships,
        show: 'detail',
        component: ChargeMembershipsView as unknown as ComponentOptions,
        isDefault: {
            properties: {}
        }
    }
])
const checkRoute = useCheckRoute();
const navigate = useNavigate();
const platform = usePlatform();

</script>
