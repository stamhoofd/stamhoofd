<template>
    <div class="st-view">
        <STNavigationBar title="Betalingen" />

        <main>
            <h1>Betalingen</h1>

            <OutstandingBalanceTable v-for="item in items" :key="item.organization.id" :item="item" :show-name="!singleOrganization" />

            <template v-if="pendingPayments.length > 0">
                <hr>
                <h2>In verwerking</h2>
                <p>Bij betalingen via overschrijving of domiciliëring kan het even duren voor we een betaling ontvangen en bevestigen. Je kan hier de status opvolgen.</p>

                <STList>
                    <STListItem v-for="payment of pendingPayments" :key="payment.id" :selectable="true" class="right-stack" @click="openPayment(payment)">
                        <template #left>
                            <figure class="style-image-with-icon gray">
                                <figure>
                                    <img v-if="payment.method === PaymentMethod.Bancontact" src="@stamhoofd/assets/images/partners/icons/bancontact.svg">
                                    <img v-else-if="payment.method === PaymentMethod.iDEAL" src="@stamhoofd/assets/images/partners/icons/ideal.svg">
                                    <span v-else class="icon bank" />
                                </figure>
                                <aside>
                                    <span class="icon clock small gray" />
                                </aside>
                            </figure>
                        </template>

                        <h3 class="style-title-list">
                            {{ PaymentMethodHelper.getNameCapitalized(payment.method) }}
                        </h3>

                        <p v-if="payment.getShortDescription()" class="style-description-small">
                            {{ payment.getShortDescription() }}
                        </p>
                        <p class="style-description-small">
                            Aangemaakt op {{ formatDate(payment.createdAt) }}
                        </p>

                        <template #right>
                            <span class="style-price-base">{{ formatPrice(payment.price) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <hr>
            <h2>Betalingen</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                Je hebt nog geen betalingen gedaan
            </p>

            <STList v-else>
                <STListItem v-for="payment of succeededPayments" :key="payment.id" :selectable="true" class="right-stack" @click="openPayment(payment)">
                    <template #left>
                        <figure class="style-image-with-icon gray">
                            <figure>
                                <img v-if="payment.method === PaymentMethod.Bancontact" src="@stamhoofd/assets/images/partners/icons/bancontact.svg">
                                <img v-else-if="payment.method === PaymentMethod.iDEAL" src="@stamhoofd/assets/images/partners/icons/ideal.svg">
                                <span v-else class="icon bank" />
                            </figure>
                            <aside />
                        </figure>
                    </template>

                    <h3 class="style-title-list">
                        {{ PaymentMethodHelper.getNameCapitalized(payment.method) }}
                    </h3>
                    <p v-if="payment.getShortDescription()" class="style-description-small">
                        {{ payment.getShortDescription() }}
                    </p>

                    <p v-if="!payment.paidAt || formatDate(payment.createdAt) !== formatDate(payment.paidAt)" class="style-description-small">
                        Aangemaakt op {{ formatDate(payment.createdAt) }}
                    </p>
                    <p v-if="payment.paidAt" class="style-description-small">
                        Betaald op {{ formatDate(payment.paidAt) }}
                    </p>

                    <template #right>
                        <span class="style-price-base">{{ formatPrice(payment.price) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { PaymentView } from '@stamhoofd/components';
import { OrganizationDetailedBillingStatusItem, PaymentGeneral, PaymentMethod, PaymentMethodHelper } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import OutstandingBalanceTable from "./OutstandingBalanceTable.vue";

const props = withDefaults(
    defineProps<{
        /**
         * Whether the view is dedicated to a single organization (so we can hide organization names in the view)
         */
        singleOrganization?: boolean,
        items: OrganizationDetailedBillingStatusItem[]
    }>(), {
        singleOrganization: false
    }
);

const present = usePresent()

const pendingPayments = computed(() => {
    return props.items.flatMap(i => i.payments).filter(p => p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
});

const succeededPayments = computed(() => {
    return props.items.flatMap(i => i.payments).filter(p => !p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
}); 

async function openPayment(payment: PaymentGeneral) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(PaymentView, {
                    payment,
                    getNext: (payment: PaymentGeneral) => {
                        const index = succeededPayments.value.findIndex(p => p.id === payment.id);
                        if (index === -1 || index === succeededPayments.value.length - 1) {
                            return null;
                        }
                        return succeededPayments.value[index + 1];
                    },
                    getPrevious: (payment: PaymentGeneral) => {
                        const index = succeededPayments.value.findIndex(p => p.id === payment.id);
                        if (index === -1 || index === 0) {
                            return null;
                        }
                        return succeededPayments.value[index - 1];
                    }
                })
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

</script>
