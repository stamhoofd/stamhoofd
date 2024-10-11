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

                <STListItem v-if="cachedOutstandingBalancesEnabled && auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.ReceivableBalance)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg">
                    </template>
                    <h2 class="style-title-list">
                        Te ontvangen bedragen
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
                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.PayableBalance, {properties: {collection: DetailedPayableBalanceCollection.create({ organizations: [item] })}})">
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

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.PayableBalance, {properties: {collection: DetailedPayableBalanceCollection.create({ organizations: [item] })}})">
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
import { ErrorBox, PayableBalanceCollectionView, useAuth, useContext, useErrors, useFeatureFlag, useOrganization } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, BalanceItemWithPayments, DetailedPayableBalanceCollection, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { ComponentOptions, ref, Ref } from 'vue';
import ReceivableBalancesTableView from '../../cached-outstanding-balance/ReceivableBalancesTableView.vue';
import PaymentsTableView from '../payments/PaymentsTableView.vue';
import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';

enum Routes {
    Transfers = 'Transfers',
    Export = 'Export',
    Payments = 'Payments',
    PayableBalance = 'PayableBalance',
    ReceivableBalance = 'ReceivableBalance',
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
        name: Routes.ReceivableBalance,
        url: 'openstaande-bedragen',
        component: ReceivableBalancesTableView as ComponentOptions,
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
        name: Routes.PayableBalance,
        url: 'openstaand/@uri',
        present: 'popup',
        params: {
            uri: String,
        },
        component: PayableBalanceCollectionView as ComponentOptions,
        async paramsToProps(params: { uri: string }) {
            await balancePromise;
            const item = outstandingBalance.value?.organizations.find(item => item.organization.uri === params.uri);

            if (!item) {
                throw new Error('Organization not found');
            }

            return {
                collection: DetailedPayableBalanceCollection.create({ organizations: [item] }),
            };
        },
        propsToParams(props) {
            if (!('collection' in props) || !(props.collection instanceof DetailedPayableBalanceCollection)) {
                throw new Error('Missing collection');
            }

            return {
                params: {
                    uri: props.collection.organizations[0].organization.uri,
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
const outstandingBalance = ref(null) as Ref<DetailedPayableBalanceCollection | null>;

const cachedOutstandingBalancesEnabled = useFeatureFlag()('cached-outstanding-balances');

const balancePromise = updateBalance().catch(console.error);

// Fetch balance
async function updateBalance() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/organization/payable-balance/detailed`,
            decoder: DetailedPayableBalanceCollection as Decoder<DetailedPayableBalanceCollection>,
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
