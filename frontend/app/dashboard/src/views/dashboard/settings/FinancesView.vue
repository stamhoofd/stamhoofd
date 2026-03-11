<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="outstandingBalance" class="st-view">
            <STNavigationBar :title="$t(`%tx`)" />

            <main class="center">
                <h1>
                    {{ $t('%tx') }}
                </h1>

                <a class="info-box icon external selectable" :href="LocalizedDomains.getDocs('boekhoudingsmodule')" target="_blank">
                    {{ $t('%1KY') }}
                </a>

                <STList class="illustration-list">
                    <STListItem v-if="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.Export)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/calculator.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%95') }}
                        </h2>
                        <p class="style-description">
                            {{ $t("%5Q") }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Transfers)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/bank.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%96') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%97') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.Payments)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1Lo') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%98') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.ReceivableBalance)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/account-balance.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%99') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%NG', {organization: organization!.name}) }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="STAMHOOFD.environment === 'development' && auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.BalanceItems)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/box.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1Ls') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%1Lt') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <div v-if="$feature('vat') && auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" class="container">
                    <hr>
                    <h2>{{ $t('%1JA') }}</h2>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Invoices)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/transfer.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%1JR') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('%1JS') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </div>

                <div v-for="item of outstandingBalance.organizations" :key="item.organization.id" class="container">
                    <hr><h2>{{ $t('%NH', {organization: item.organization.name}) }}</h2>
                    <p>{{ $t('%NI', {organization: item.organization.name}) }}</p>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.PayableBalance, {params: {uri: item.organization.uri}})">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%76') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('%NJ') }}
                            </p>

                            <p v-if="BalanceItem.getOutstandingBalance(item.balanceItems).pricePending > 0" class="style-description">
                                {{ $t('%NK', {price: formatPrice(BalanceItem.getOutstandingBalance(item.balanceItems).pricePending)}) }}
                            </p>

                            <template #right>
                                <p class="style-price">
                                    {{ formatPrice(BalanceItem.getOutstandingBalance(item.balanceItems.filter(b => b.isDue)).priceOpen) }}
                                </p>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.PayableBalance, {params: {uri: item.organization.uri}})">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/transfer.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%NL') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('%NM', {organization: item.organization.name}) }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </div>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { ErrorBox, LoadingViewTransition, PayableBalanceCollectionView, useAuth, useContext, useErrors, useOrganization } from '@stamhoofd/components';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, BalanceItem, DetailedPayableBalanceCollection, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { ComponentOptions, ref, Ref } from 'vue';
import InvoicesTableView from '../invoices/InvoicesTableView.vue';
import PaymentsTableView from '../payments/PaymentsTableView.vue';
import ReceivableBalancesTableView from '../receivable-balances/ReceivableBalancesTableView.vue';
import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';
import BalanceItemsTableView from '../balance-items/BalanceItemsTableView.vue';

enum Routes {
    Transfers = 'Transfers',
    Export = 'Export',
    Payments = 'Payments',
    BalanceItems = 'BalanceItems',
    Invoices = 'Invoices',
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
        name: Routes.BalanceItems,
        url: 'balance-items',
        component: BalanceItemsTableView as ComponentOptions,
    },
    {
        name: Routes.Invoices,
        url: 'facturen',
        component: InvoicesTableView as ComponentOptions,
        paramsToProps() {
            return {};
        },
    },
    {
        name: Routes.Export,
        url: 'exporteren',
        present: 'popup',
        component: ConfigurePaymentExportView,
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
                reload: async () => {
                    await updateBalance();
                    const item = outstandingBalance.value?.organizations.find(item => item.organization.uri === params.uri);
                    if (!item) {
                        return DetailedPayableBalanceCollection.create({ organizations: [] });
                    }
                    return DetailedPayableBalanceCollection.create({ organizations: [item] });
                },
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
