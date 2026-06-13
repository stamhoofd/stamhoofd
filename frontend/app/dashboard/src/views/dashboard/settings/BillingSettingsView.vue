<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>

            <div class="split-inputs">
                <div>
                    <STInputBox :title="balanceTotal >= 0 ? $t('%76') : $t('Tegoed')">
                        <button class="style-price-big" type="button" @click="payBalance">
                            <span>
                                {{ formatPrice(Math.abs(balanceTotal)) }}
                            </span>
                            <span v-if="balanceTotal > 0" class="icon arrow-right" />
                        </button>
                    </STInputBox>
                    <p class="style-description-small">
                        {{ balanceTotal >= 0 ? $t('%1TU') : $t('Dit bedrag zal bij jouw volgende afrekening in mindering worden gebracht') }}
                    </p>
                </div>
            </div>

            <template v-if="item.organization.meta.registrationPaymentConfiguration.enableMandates">
                <hr>
                <h2 class="style-with-button">
                    <span>{{ $t('%1QF') }}</span>
                    <button v-tooltip="$t('%1Qg')" type="button" class="button icon add" @click="addCard" />
                </h2>
                <p v-if="!$isPlatform">
                    {{ $t('%1Qz') }}
                </p>

                <PayableBalanceMandatesBox :item="item" />
            </template>

            <template v-if="item.organization.meta.invoicesEnabled">
                <hr>
                <h2>{{ $t('%1Ke') }}</h2>
                <p>{{ $t('%1TB') }}</p>

                <button v-if="organization.meta.companies.length === 0" class="info-box selectable" type="button" @click="$navigate(Routes.Settings)">
                    <span>{{ $t('%1TK') }}</span>

                    <span class="button text">
                        {{ $t('%9H') }}
                    </span>
                </button>

                <STList v-else>
                    <CompanyRow :company="organization.meta.companies[0]" :selectable="true" @click="$navigate(Routes.Settings)">
                        <template #right>
                            <span class="icon edit gray" />
                        </template>
                    </CompanyRow>
                </STList>
            </template>

            <template v-if="pendingPayments.length > 0">
                <hr><h2>{{ $t('%1PL') }}</h2>
                <p>{{ $t('%h6') }}</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment" />
                </STList>
            </template>

            <template v-if="item.organization.meta.invoicesEnabled || showPackages">
                <hr>
                <h2>{{ $t('%1Rm') }}</h2>

                <STList>
                    <STListItem v-if="item.organization.meta.invoicesEnabled" :selectable="true" element-name="button" @click="$navigate(Routes.Invoices)">
                        <template #left>
                            <IconContainer icon="receipt" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%1JA') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%1Sj') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" element-name="button" @click="$navigate(Routes.Payments)">
                        <template #left>
                            <IconContainer icon="bank" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%1JH') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%1Ql') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="showPackages" :selectable="true" element-name="button" @click="$navigate(Routes.Packages)">
                        <template #left>
                            <IconContainer icon="box" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('Functionaliteiten activeren') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Activeer nieuwe fucnties') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-else>
                <hr><h2>{{ $t('%1JH') }}</h2>

                <p v-if="succeededPayments.length === 0" class="info-box">
                    {{ $t('%h7') }}
                </p>

                <STList v-else>
                    <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
                </STList>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { Request } from '@simonbackx/simple-networking';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import CompanyRow from '@stamhoofd/components/companies/CompanyRow.vue';
import { useGlobalEventListener } from '@stamhoofd/components/hooks/useGlobalEventListener';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';
import { useVisibilityChange } from '@stamhoofd/components/hooks/useVisibilityChange';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import PayableBalanceMandatesBox from '@stamhoofd/components/payments/components/PayableBalanceMandatesBox.vue';
import PaymentRow from '@stamhoofd/components/payments/components/PaymentRow.vue';
import type { DetailedPayableBalance } from '@stamhoofd/structures';
import { BalanceItem, OrganizationCheckout } from '@stamhoofd/structures';
import { CreateMandateSettings } from '@stamhoofd/structures/checkout/CreateMandateSettings.js';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useLoadPayableBalance } from './hooks/useLoadPayableBalance';
import { PayBalanceMode } from './packages/OrganizationCheckoutViewModel';
import { useStartOrganizationCheckout } from './packages/useStartOrganizationCheckout';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();

const organization = useRequiredOrganization();
const platform = usePlatform();
const startOrganizationCheckout = useStartOrganizationCheckout();
const loadPayableBalance = useLoadPayableBalance();

const showPackages = computed(() => {
    return STAMHOOFD.userMode === 'organization' && platform.value.membershipOrganizationId !== null
        && props.item.organization.id === platform.value.membershipOrganizationId;
});

useGlobalEventListener('payment-succeeded', async () => {
    reload().catch(console.error);
});

useVisibilityChange(() => {
    reload().catch(console.error);
});

const balanceTotal = computed(() => BalanceItem.getOutstandingBalance(props.item.balanceItems.filter(b => b.isDue)).priceOpen);

async function reload() {
    try {
        const payable = await loadPayableBalance(props.item.organization.id);
        props.item.deepSet(payable);
    } catch (e) {
        if (Request.isAbortError(e)) {
            return;
        }
        Toast.fromError(e).show();
    }
}

const title = props.item.organization.meta.invoicesEnabled ? $t('%1S7') : $t('%1QB');

enum Routes {
    Payments = 'betalingen',
    Credits = 'credits',
    Invoices = 'facturen',
    Settings = 'instellingen',
    Items = 'items',
    Packages = 'functionaliteiten',
}

defineRoutes([
    {
        url: Routes.Payments,
        component: async () => (await import('@stamhoofd/components/payments/PayableBalancePaymentsView.vue')).default,
        present: 'popup',
        defaultProperties() {
            return {
                item: props.item,
            };
        },
    },
    {
        url: Routes.Invoices,
        component: async () => (await import('@stamhoofd/components/payments/PayableInvoicesView.vue')).default,
        present: 'popup',
        defaultProperties() {
            return {
                item: props.item,
            };
        },
    },
    {
        url: Routes.Settings,
        component: async () => (await import('@stamhoofd/components/organizations/GeneralSettingsView.vue')).default,
        present: 'popup',
    },
    {
        url: Routes.Items,
        component: async () => (await import('./PayableBalanceItemsView.vue')).default,
        present: 'popup',
        defaultProperties() {
            return {
                item: props.item,
            };
        },
    },
    {
        url: Routes.Packages,
        component: async () => (await import('./packages/PackageSettingsView.vue')).default,
        present: 'popup',
    },
]);

const $navigate = useNavigate();

const pendingPayments = computed(() => {
    return props.item.payments.filter(p => p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
});

const succeededPayments = computed(() => {
    return props.item.payments.filter(p => !p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
});

async function addCard() {
    await startOrganizationCheckout({
        payBalanceMode: PayBalanceMode.Optional,
        forceNewMandate: true,
        sellingOrganization: props.item.organization,
        payableBalance: props.item,
        checkout: OrganizationCheckout.create({
            createMandate: CreateMandateSettings.create({
                saveAsDefault: true,
            }),
        }),
        displayOptions: {
            action: 'present',
            modalDisplayStyle: 'popup',
        },
    });
}

async function payBalance() {
    if (props.item.payableBalanceItems.filter(b => b.isDue).length === 0) {
        return;
    }
    await startOrganizationCheckout({
        payBalanceMode: PayBalanceMode.Recommended,
        sellingOrganization: props.item.organization,
        payableBalance: props.item,
        checkout: OrganizationCheckout.create({}),
        displayOptions: {
            action: 'present',
            modalDisplayStyle: 'popup',
        },
    });
}

</script>
