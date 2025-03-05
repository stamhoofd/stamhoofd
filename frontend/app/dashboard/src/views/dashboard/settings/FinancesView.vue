<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="outstandingBalance" class="st-view">
            <STNavigationBar :title="$t(`Boekhouding`)"/>

            <main class="center">
                <h1>
                    {{ $t('dd4005f0-77d2-4eba-ad52-170c4b32cc12') }}
                </h1>

                <STList class="illustration-list">
                    <STListItem v-if="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.Export)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/calculator.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('c251ef40-6acd-43a7-b5dd-06d754ccf9fa') }}
                        </h2>
                        <p class="style-description">
                            {{ $t("64633f7b-2d6e-4ad2-abb1-e9dd77d9a81f") }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Transfers)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/check-transfer.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('df0f4cac-a8a0-42b0-9fe4-f0e6889cb082') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('b5effe89-d4d1-45e3-b81e-0d44b1586d20') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Payments)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('b1ea3ba9-e5ff-4e89-bab2-8046f87dd36d') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('af385f78-1645-48dc-b5c8-2542ae6b1e3b') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="cachedOutstandingBalancesEnabled && auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" :selectable="true" class="left-center" @click="$navigate(Routes.ReceivableBalance)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('fd6cad1d-f27a-4f18-8b07-deff71e36311') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('afc177f8-2029-4ab4-a747-d3853b1b2954') }} {{ organization!.name }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

                <div v-for="item of outstandingBalance.organizations" :key="item.organization.id" class="container">
                    <hr><h2>{{ $t('35de14d7-7b29-4207-a88d-da9ae59f8fb0') }} {{ item.organization.name }}</h2>
                    <p>{{ $t('4ce4b43c-ffec-4ce7-904d-8e2649be67e7') }} {{ item.organization.name }}{{ $t('ad53a2cb-5c27-474f-8f23-1190e0477054') }}</p>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.PayableBalance, {params: {uri: item.organization.uri}})">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg"></template>
                            <h2 class="style-title-list">
                                {{ $t('db1257af-600c-4898-897c-fd4d3c380009') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('24b1da46-b70b-4c53-8adb-5faacc90d4f9') }}
                            </p>

                            <p v-if="BalanceItem.getOutstandingBalance(item.balanceItems).pricePending > 0" class="style-description">
                                {{ $t('b7c32c48-67a1-4011-ab34-82f21dfc7398') }} {{ formatPrice(BalanceItem.getOutstandingBalance(item.balanceItems).pricePending) }} {{ $t('f34fb529-ddd6-45b6-ba9d-405f5450ac83') }}
                            </p>

                            <template #right>
                                <p class="style-price">
                                    {{ formatPrice(BalanceItem.getOutstandingBalance(item.balanceItems.filter(b => b.isDue)).priceOpen) }}
                                </p>
                                <span class="icon arrow-right-small gray"/>
                            </template>
                        </STListItem>

                        <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.PayableBalance, {params: {uri: item.organization.uri}})">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/transfer.svg"></template>
                            <h2 class="style-title-list">
                                {{ $t('49e2e5a4-9a64-4acb-9a21-fc9496522480') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('42eab8af-0f14-4e76-9c8a-e671ba9e482c') }} {{ item.organization.name }}.
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray"/>
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
import { ErrorBox, LoadingViewTransition, PayableBalanceCollectionView, useAuth, useContext, useErrors, useFeatureFlag, useOrganization } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, BalanceItem, DetailedPayableBalanceCollection, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { ComponentOptions, ref, Ref } from 'vue';
import PaymentsTableView from '../payments/PaymentsTableView.vue';
import ReceivableBalancesTableView from '../receivable-balances/ReceivableBalancesTableView.vue';
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
