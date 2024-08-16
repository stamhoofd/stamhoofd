<template>
    <div class="st-view">
        <STNavigationBar title="Boekhouding" />

        <main class="center">
            <h1>
                Boekhouding
            </h1>

            <STList class="illustration-list">    
                <STListItem v-if="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.Export)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/calculator.svg">
                    </template>
                    <h2 class="style-title-list">
                        Betalingen exporteren
                    </h2>
                    <p class="style-description">
                        Alle betalingen, transactiekosten en uitbetalingen die via Stamhoofd verliepen.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Transfers)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/check-transfer.svg">
                    </template>
                    <h2 class="style-title-list">
                        Overschrijvingen controleren
                    </h2>
                    <p class="style-description">
                        Markeer overschrijvingen als betaald.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { useAuth } from '@stamhoofd/components';
import { AccessRight, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { ComponentOptions } from 'vue';
import PaymentsTableView from '../payments/PaymentsTableView.vue';
import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';

enum Routes {
    Transfers = "Transfers",
    Export = "Export"
}

defineRoutes([
    {
        name: Routes.Transfers,
        url: 'overschrijvingen',
        component: PaymentsTableView as ComponentOptions,
        paramsToProps() {
            return {
                methods: [PaymentMethod.Transfer],
                defaultFilter: {
                    status: {
                        $in: [
                            PaymentStatus.Pending,
                            PaymentStatus.Created
                        ]
                    }
                }
            }
        }
    },
    {
        name: Routes.Export,
        url: 'exporteren',
        present: 'popup',
        component: ConfigurePaymentExportView as unknown as ComponentOptions,
    }
])

const auth = useAuth()
const $navigate = useNavigate();

</script>
