<template>
    <STListItem :selectable="true" class="right-stack" @click="openPayment(payment)">
        <template #left>
            <PaymentMethodIcon :method="payment.method">
                <span v-if="payment.status === PaymentStatus.Failed" class="icon disabled small error" />
                <span v-if="payment.status === PaymentStatus.Pending || payment.status === PaymentStatus.Created" class="icon clock small gray" />
            </PaymentMethodIcon>
        </template>

        <h3 class="style-title-list">
            {{ PaymentMethodHelper.getNameCapitalized(payment.method) }}
        </h3>
        <p v-if="payment instanceof PaymentGeneral && payment.getShortDescription()" class="style-description-small">
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
</template>


<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { Payment, PaymentGeneral, PaymentMethodHelper, PaymentStatus } from '@stamhoofd/structures';
import AsyncPaymentView from '../AsyncPaymentView.vue';
import PaymentMethodIcon from './PaymentMethodIcon.vue';

const props = withDefaults(
    defineProps<{
        payment: PaymentGeneral|Payment,
        payments?: (PaymentGeneral|Payment)[]
    }>(), {
        payments: () => []
    }
);

const present = usePresent()

async function openPayment(payment: PaymentGeneral|Payment) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(AsyncPaymentView, {
                    payment,
                    getNext: (payment: PaymentGeneral|Payment) => {
                        const index = props.payments.findIndex(p => p.id === payment.id);
                        if (index === -1 || index === props.payments.length - 1) {
                            return null;
                        }
                        return props.payments[index + 1];
                    },
                    getPrevious: (payment: PaymentGeneral|Payment) => {
                        const index = props.payments.findIndex(p => p.id === payment.id);
                        if (index === -1 || index === 0) {
                            return null;
                        }
                        return props.payments[index - 1];
                    }
                })
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

</script>
