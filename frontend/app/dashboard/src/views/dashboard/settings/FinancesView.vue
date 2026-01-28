<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="outstandingBalance" class="st-view">
            <STNavigationBar :title="$t(`0fc72e2d-5fe5-4ed2-ba5d-1f880790c174`)" />

            <main class="center">
                <h1>
                    {{ $t('5d5cb596-1b5b-4ec3-98dd-2c0f012d9093') }}
                </h1>

                <STList class="illustration-list">
                    <STListItem v-if="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.Export)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/calculator.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('bcc00835-8af6-4b3a-ad77-691c724af03d') }}
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
                            <img src="@stamhoofd/assets/images/illustrations/bank.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('bf002215-26cc-4f43-9bf7-3cca60d50a10') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('d40fa481-cb6d-44ab-bacb-ad8e6fe00cdc') }}
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
                            {{ $t('9365e40e-8b00-4b24-8e15-6312aa624fbb') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('8a2e0bd7-27ea-455b-945a-445d91f0ebea') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.ReceivableBalance)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('3df2215e-5c13-493d-afc6-4a866150960c') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('d74d7aec-8fd5-489a-b93d-89d56ca8ae34', {organization: organization!.name}) }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <div v-if="$feature('vat') && auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" class="container">
                    <hr>
                    <h2>{{ $t('54f30f31-26eb-4801-8f03-4ec17bcb9b95') }}</h2>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Invoices)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/transfer.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('fa389e74-a5d7-43da-8ce5-805c3a6e1a53') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('5a61bab4-4702-4c66-977c-d97fb306049e') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </div>

                <div v-for="item of outstandingBalance.organizations" :key="item.organization.id" class="container">
                    <hr><h2>{{ $t('027d88ac-a3a4-4193-bc1b-8e671bbc6637', {organization: item.organization.name}) }}</h2>
                    <p>{{ $t('4aa391d7-2367-43fe-a4ce-c4d18b9e46d9', {organization: item.organization.name}) }}</p>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.PayableBalance, {params: {uri: item.organization.uri}})">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('40d7ac9f-f62d-4a9d-8b2f-5fcfb938c12f') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('ef30fb68-251e-410b-8e95-df01fa30359e') }}
                            </p>

                            <p v-if="BalanceItem.getOutstandingBalance(item.balanceItems).pricePending > 0" class="style-description">
                                {{ $t('1602ef29-3f5c-4ec6-a57a-d80361d89013', {price: formatPrice(BalanceItem.getOutstandingBalance(item.balanceItems).pricePending)}) }}
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
                                {{ $t('774d7eaf-dee1-4549-8531-7c6ac622e123') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('7731a1c3-1ed2-4b46-8c21-b5cd67c8c521', {organization: item.organization.name}) }}
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
import { useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, BalanceItem, DetailedPayableBalanceCollection, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { ComponentOptions, ref, Ref } from 'vue';
import PaymentsTableView from '../payments/PaymentsTableView.vue';
import ReceivableBalancesTableView from '../receivable-balances/ReceivableBalancesTableView.vue';
import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';
import InvoicesTableView from '../invoices/InvoicesTableView.vue';

enum Routes {
    Transfers = 'Transfers',
    Export = 'Export',
    Payments = 'Payments',
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
