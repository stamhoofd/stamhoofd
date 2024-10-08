<template>
    <LoadingView v-if="!outstandingBalance" :error-box="errors.errorBox" />
    <div v-else class="st-view">
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
                        {{ $t("64633f7b-2d6e-4ad2-abb1-e9dd77d9a81f") }}
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

                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Payments)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/creditcards.svg">
                    </template>
                    <h2 class="style-title-list">
                        Alle betalingen
                    </h2>
                    <p class="style-description">
                        Controleer alle betalingen die in het systeem aanwezig zijn, inclusief eventueel mislukte betaalpogingen.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="cachedOutstandingBalancesEnabled && auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.CachedOutstandingBalance)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg">
                    </template>
                    <h2 class="style-title-list">
                        Openstaande bedragen
                    </h2>
                    <p class="style-description">
                        Lijst van alle leden en verenigingen die nog een openstaand bedrag hebben tegenover {{ organization!.name }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <div v-for="item of outstandingBalance.organizations" :key="item.organization.id" class="container">
                <hr>
                <h2>Betalingen aan {{ item.organization.name }}</h2>
                <p>Hier vind je een overzicht van wat je moet betalen aan {{ item.organization.name }}, bv. voor de aansluitingkosten van leden.</p>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.OutstandingBalance, {properties: {items: [item]}})">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg">
                        </template>
                        <h2 class="style-title-list">
                            Openstaand bedrag
                        </h2>
                        <p class="style-description">
                            Breng de betaling van dit bedrag in orde.
                        </p>

                        <p v-if="BalanceItemWithPayments.getOutstandingBalance(item.balanceItems).totalPending > 0" class="style-description">
                            Betaling van {{ formatPrice(BalanceItemWithPayments.getOutstandingBalance(item.balanceItems).totalPending) }} gestart, maar nog in verwerking.
                        </p>

                        <template #right>
                            <p class="style-price">
                                {{ formatPrice(BalanceItemWithPayments.getOutstandingBalance(item.balanceItems).totalOpen) }}
                            </p>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.OutstandingBalance, {properties: {items: [item]}})">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/transfer.svg">
                        </template>
                        <h2 class="style-title-list">
                            Betaalbewijzen
                        </h2>
                        <p class="style-description">
                            Bekijk een overzicht van jouw betalingen aan {{ item.organization.name }}.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { ErrorBox, useAuth, useContext, useErrors, BillingStatusView, useOrganization, useFeatureFlag } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, BalanceItemWithPayments, OrganizationDetailedBillingStatus, OrganizationDetailedBillingStatusItem, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { ComponentOptions, ref, Ref } from 'vue';
import PaymentsTableView from '../payments/PaymentsTableView.vue';
import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';
import CachedOutstandingBalanceTableView from '../../cached-outstanding-balance/CachedOutstandingBalanceTableView.vue';

enum Routes {
    Transfers = 'Transfers',
    Export = 'Export',
    Payments = 'Payments',
    OutstandingBalance = 'OutstandingBalance',
    CachedOutstandingBalance = 'CachedOutstandingBalance',
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
                            PaymentStatus.Created,
                        ],
                    },
                },
            };
        },
    },
    {
        name: Routes.CachedOutstandingBalance,
        url: 'openstaande-bedragen',
        component: CachedOutstandingBalanceTableView as ComponentOptions,
    },
    {
        name: Routes.Payments,
        url: 'betalingen',
        component: PaymentsTableView as ComponentOptions,
        paramsToProps() {
            return {
                defaultFilter: {
                    status: {
                        $in: [
                            PaymentStatus.Succeeded,
                        ],
                    },
                },
            };
        },
    },
    {
        name: Routes.Export,
        url: 'exporteren',
        present: 'popup',
        component: ConfigurePaymentExportView as unknown as ComponentOptions,
    },
    {
        name: Routes.OutstandingBalance,
        url: 'openstaand/@uri',
        present: 'popup',
        params: {
            uri: String,
        },
        component: BillingStatusView as ComponentOptions,
        async paramsToProps(params: { uri: string }) {
            await balancePromise;
            const item = outstandingBalance.value?.organizations.find(item => item.organization.uri === params.uri);

            if (!item) {
                throw new Error('Organization not found');
            }

            return {
                items: [item],
            };
        },
        propsToParams(props) {
            if (!('items' in props) || (!Array.isArray(props.items)) || !(props.items[0] instanceof OrganizationDetailedBillingStatusItem)) {
                throw new Error('Missing items');
            }

            return {
                params: {
                    uri: props.items[0].organization.uri,
                },
            };
        },
    },
]);

const auth = useAuth();
const $navigate = useNavigate();
const owner = useRequestOwner();
const context = useContext();
const errors = useErrors();
const organization = useOrganization();
const outstandingBalance = ref(null) as Ref<OrganizationDetailedBillingStatus | null>;

const cachedOutstandingBalancesEnabled = useFeatureFlag()('cached-outstanding-balances');

const balancePromise = updateBalance().catch(console.error);

// Fetch balance
async function updateBalance() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/organization/billing/status/detailed`,
            decoder: OrganizationDetailedBillingStatus as Decoder<OrganizationDetailedBillingStatus>,
            shouldRetry: true,
            owner,
            timeout: 5 * 60 * 1000,
        });

        outstandingBalance.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
