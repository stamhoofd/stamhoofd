<template>
    <STListItem :selectable="true" :class="'right-stack ' +payment.theme" @click="navigate(Route)">
        <template #left>
            <PaymentMethodIcon :method="payment.method" :type="payment.type" :boxed="true">
                <template #aside>
                    <span v-if="payment.type !== PaymentType.Payment && payment.method !== PaymentMethod.Unknown" :class="'icon tiny stroke primary ' + PaymentTypeHelper.getIcon(payment.type)" />
                    <span v-if="payment.status === PaymentStatus.Failed" class="icon disabled tiny red stroke" />
                    <span v-if="payment.status === PaymentStatus.Pending || payment.status === PaymentStatus.Created" class="icon hourglass tiny primary stroke" />
                </template>
            </PaymentMethodIcon>
        </template>

        <p v-if="payment.type !== PaymentType.Payment && payment.method !== PaymentMethod.Unknown" class="style-title-prefix-list">
            <span>{{ PaymentTypeHelper.getName(payment.type) }}</span>
        </p>

        <h3 class="style-title-list">
            {{ payment.title }}
        </h3>

        <p v-if="payment instanceof PaymentGeneral && payment.getShortDescription()" class="style-description-small">
            {{ payment.getShortDescription() }}
        </p>

        <p v-if="!payment.paidAt || formatDate(payment.createdAt) !== formatDate(payment.paidAt)" class="style-description-small">
            {{ $t('%hq', {date: formatDate(payment.createdAt)}) }}
        </p>
        <p v-if="payment.paidAt" class="style-description-small">
            {{ $t('%hr', {date: formatDate(payment.paidAt)}) }}
        </p>
        <p v-if="payment.price && price !== null && price !== payment.price" class="style-description-small">
            {{ $t('%hs', {price: formatPrice(payment.price)}) }}
        </p>

        <template #right>
            <span class="style-price-base" :class="{negative: (price ?? payment.price) < 0}">{{ formatPrice(price ?? payment.price) }}</span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { defineRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import type { Payment } from '@stamhoofd/structures';
import { PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PaymentTypeHelper } from '@stamhoofd/structures';

import PaymentMethodIcon from './PaymentMethodIcon.vue';

const props = withDefaults(
    defineProps<{
        payment: PaymentGeneral | Payment;
        price?: number | null;
        payments?: (PaymentGeneral | Payment)[];
    }>(), {
        payments: () => [],
        price: null,
    },
);

const navigate = useNavigate();

const Route = defineRoute({
    url: props.payment.id,
    show: true,
    component: async () => (await import('../AsyncPaymentView.vue')).default,
    defaultProperties() {
        return {
            payment: props.payment,
            getNext: (payment: PaymentGeneral | Payment) => {
                const index = props.payments.findIndex(p => p.id === payment.id);
                if (index === -1 || index === props.payments.length - 1) {
                    return null;
                }
                return props.payments[index + 1];
            },
            getPrevious: (payment: PaymentGeneral | Payment) => {
                const index = props.payments.findIndex(p => p.id === payment.id);
                if (index === -1 || index === 0) {
                    return null;
                }
                return props.payments[index - 1];
            },
        };
    },
});

</script>
