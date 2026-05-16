<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>

            <div class="split-inputs">
                <div>
                    <STInputBox :title="$t('Openstaand bedrag')">
                        <button class="style-price-big" type="button" @click="item.balanceItems.filter(b => b.isDue).length > 0 ? payBalance : undefined">
                            <span>
                                {{ formatPrice(BalanceItem.getOutstandingBalance(item.balanceItems.filter(b => b.isDue)).priceOpen) }}
                            </span>
                            <span v-if="BalanceItem.getOutstandingBalance(item.balanceItems.filter(b => b.isDue)).priceOpen > 0" class="icon arrow-right" />
                        </button>
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('Dit bedrag zal bij jouw volgende afrekening aangerekend worden.') }}
                    </p>
                </div>
            </div>

            <template v-if="item.organization.meta.registrationPaymentConfiguration.enableMandates">
                <hr>
                <h2 class="style-with-button">
                    <span>{{ $t('Standaard bankkaart') }}</span>
                    <button v-tooltip="$t('Nieuwe bankkaart koppelen')" type="button" class="button icon add" @click="addCard" />
                </h2>
                <p v-if="!$isPlatform">
                    {{ $t('Kies een bankkaart of creditcard waarmee de periodieke betalingen gebeuren.') }}
                </p>

                <PayableBalanceMandatesBox :item="item" />
            </template>

        
            <template v-if="item.organization.meta.invoicesEnabled">
                <hr>
                <h2>{{ $t('Facturatiegegevens') }}</h2>
                <p>{{ $t('Deze gegevens worden gebruikt voor alle toekomstige facturen.') }}</p>

                <button v-if="organization.meta.companies.length === 0" class="info-box selectable" type="button" @click="$navigate(Routes.Settings)">
                    <span>{{ $t('Je hebt nog geen facturatiegegevens ingesteld. Voeg deze eerst toe via de algemene instellingen.') }}</span>

                    <span class="button text">
                        {{ $t('Instellen') }}
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

            <template v-if="item.organization.meta.invoicesEnabled">
                <hr>
                <h2>{{ $t('Facturen en transacties') }}</h2>

                <STList>
                    <STListItem :selectable="true" element-name="button" @click="$navigate(Routes.Invoices)">
                        <template #left>
                            <IconContainer icon="receipt" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('Facturen') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Bekijk en download een kopie van alle facturen die je hebt ontvangen') }}
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
                            {{ $t('Betalingen') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Een overzicht van alle betalingen die je hebt gedaan') }}
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
import { Toast, useGlobalEventListener, useVisibilityChange } from '@stamhoofd/components';
import CompanyRow from '@stamhoofd/components/companies/CompanyRow.vue';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import GeneralSettingsView from '@stamhoofd/components/organizations/GeneralSettingsView.vue';
import PayableBalancePaymentsView from '@stamhoofd/components/payments/PayableBalancePaymentsView.vue';
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
import PayableBalanceItemsView from './PayableBalanceItemsView.vue';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();

const organization = useRequiredOrganization()
const startOrganizationCheckout = useStartOrganizationCheckout()
const loadPayableBalance = useLoadPayableBalance();

useGlobalEventListener('payment-succeeded', async () => {
    reload().catch(console.error)
});

useVisibilityChange(() => {
    reload().catch(console.error)
})

async function reload() {
    try {
        const payable = await loadPayableBalance(props.item.organization.id)
        props.item.deepSet(payable)
    } catch (e) {
        if (Request.isAbortError(e)) {
            return;
        }
        Toast.fromError(e).show()
    }
}

const title = props.item.organization.meta.invoicesEnabled ? $t('Facturen en betaalinstellingen') : $t('Betalingen en betaalinstellingen')

enum Routes {
    Payments = 'betalingen',
    Credits = 'credits',
    Invoices = 'facturen',
    Settings = 'instellingen',
    Items = 'items'
}

defineRoutes([
    {
        url: Routes.Payments,
        component: PayableBalancePaymentsView,
        present: 'popup',
        paramsToProps() {
            return {
                item: props.item
            };
        },
    },
    {
        url: Routes.Invoices,
        component: PayableBalancePaymentsView,
        present: 'popup',
        paramsToProps() {
            return {
                item: props.item
            };
        },
    },
    {
        url: Routes.Settings,
        component: GeneralSettingsView,
        present: 'popup'
    },
    {
        url: Routes.Items,
        component: PayableBalanceItemsView,
        present: 'popup',
        paramsToProps() {
            return {
                item: props.item
            };
        },
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
                saveAsDefault: true
            })
        }),
        displayOptions: {
            action: 'present',
            modalDisplayStyle: 'popup'
        }
    })
}


async function payBalance() {
    await startOrganizationCheckout({
        payBalanceMode: PayBalanceMode.Recommended,
        sellingOrganization: props.item.organization,
        payableBalance: props.item,
        checkout: OrganizationCheckout.create({}),
        displayOptions: {
            action: 'present',
            modalDisplayStyle: 'popup'
        }
    })
}


</script>
