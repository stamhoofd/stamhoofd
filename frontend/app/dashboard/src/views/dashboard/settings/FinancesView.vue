<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="outstandingBalance" class="st-view">
            <STNavigationBar :title="$t(`%tx`)" />

            <main class="center">
                <h1>
                    {{ $t('%tx') }}
                </h1>
                <BillingWarningBox v-if="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" />

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

                <div v-if="organization?.meta.invoicesEnabled && auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" class="container">
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
                    <hr>
                    <h2>{{ $t('%NH', {organization: item.organization.name}) }}</h2>
                    <p v-if="$isPlatform">
                        {{ $t('%NI', {organization: item.organization.name}) }}
                    </p>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.PayableBalanceItems, {params: {uri: item.organization.uri}})">
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
                                {{ item.organization.meta.invoicesEnabled ? $t('%1S7') : $t('%NL') }}
                            </h2>
                            <p class="style-description">
                                {{ item.organization.meta.invoicesEnabled ? $t('%1QW') : $t('%NM', {organization: item.organization.name}) }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem v-if="!$isPlatform" :selectable="true" class="left-center" @click="$navigate(Routes.Packages)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/stock.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%1HV') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('%1HW') }}
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
import type { Decoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { AccessRight, BalanceItem, DetailedPayableBalance, DetailedPayableBalanceCollection, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { ref } from 'vue';
import BalanceItemsTableView from '../balance-items/BalanceItemsTableView.vue';
import InvoicesTableView from '../invoices/InvoicesTableView.vue';
import PaymentsTableView from '../payments/PaymentsTableView.vue';
import ReceivableBalancesTableView from '../receivable-balances/ReceivableBalancesTableView.vue';
import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';
import BillingSettingsView from './BillingSettingsView.vue';
import PackageSettingsView from './packages/PackageSettingsView.vue';
import PayableBalanceItemsView from './PayableBalanceItemsView.vue';
import { useGlobalEventListener } from '@stamhoofd/components/hooks/useGlobalEventListener';
import BillingWarningBox from './packages/BillingWarningBox.vue';

enum Routes {
    Transfers = 'Transfers',
    Export = 'Export',
    Payments = 'Payments',
    BalanceItems = 'BalanceItems',
    Invoices = 'Invoices',
    PayableBalanceItems = 'PayableBalanceItems',
    PayableBalance = 'PayableBalance',
    ReceivableBalance = 'ReceivableBalance',
    Packages = 'pakketten',
}

const isPlatform = STAMHOOFD.userMode === 'platform';

defineRoutes([
    {
        name: Routes.Transfers,
        url: 'overschrijvingen',
        component: PaymentsTableView,
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
        component: ReceivableBalancesTableView,
    },
    {
        name: Routes.Payments,
        url: 'betalingen',
        component: PaymentsTableView,
        paramsToProps() {
            return {
                defaultFilter: [
                    {
                        status: {
                            $in: [
                                PaymentStatus.Succeeded,
                            ],
                        },
                    },
                    { price: { $neq: 0 } },
                ],
            };
        },
    },
    {
        name: Routes.BalanceItems,
        url: 'balance-items',
        component: BalanceItemsTableView,
    },
    {
        name: Routes.Invoices,
        url: 'facturen',
        component: InvoicesTableView,
        paramsToProps() {
            return {};
        },
    },
    {
        name: Routes.Export,
        url: 'exporteren',
        present: 'popup',
        component: () => ConfigurePaymentExportView,
    },
    {
        name: Routes.PayableBalanceItems,
        url: 'openstaand/@uri/items',
        present: 'popup',
        params: {
            uri: String,
        },
        component: PayableBalanceItemsView,
        async paramsToProps(params: { uri: string }) {
            await balancePromise;
            const item = outstandingBalance.value?.organizations.find(item => item.organization.uri === params.uri);

            if (!item) {
                throw new Error('Organization not found');
            }

            return {
                item,
                reload: async () => {
                    await updateBalance();
                    const newItem = outstandingBalance.value?.organizations.find(item => item.organization.uri === params.uri);
                    if (!newItem) {
                        return DetailedPayableBalance.create({ organization: item.organization });
                    }
                    return newItem;
                },
            };
        },
        propsToParams(props) {
            if (!('item' in props) || !(props.item instanceof DetailedPayableBalance)) {
                throw new Error('Missing item');
            }

            return {
                params: {
                    uri: props.item.organization.uri,
                },
            };
        },
    },
    {
        name: Routes.PayableBalance,
        url: 'openstaand/@uri',
        present: 'popup',
        params: {
            uri: String,
        },
        component: BillingSettingsView,
        async paramsToProps(params: { uri: string }) {
            await balancePromise;
            const item = outstandingBalance.value?.organizations.find(item => item.organization.uri === params.uri);

            if (!item) {
                throw new Error('Organization not found');
            }

            return {
                item,
                reload: async () => {
                    await updateBalance();
                    const newItem = outstandingBalance.value?.organizations.find(item => item.organization.uri === params.uri);
                    if (!newItem) {
                        return DetailedPayableBalance.create({ organization: item.organization });
                    }
                    return newItem;
                },
            };
        },
        propsToParams(props) {
            if (!('item' in props) || !(props.item instanceof DetailedPayableBalance)) {
                throw new Error('Missing item');
            }

            return {
                params: {
                    uri: props.item.organization.uri,
                },
            };
        },
    },
    ...(!isPlatform
        ? [
                {
                    url: Routes.Packages,
                    present: 'popup' as const,
                    component: PackageSettingsView,
                },
            ]
        : []),
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
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

useGlobalEventListener('payment-succeeded', async () => {
    updateBalance().catch(console.error);
});

</script>
