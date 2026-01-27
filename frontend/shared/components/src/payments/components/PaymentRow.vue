<template>
    <STListItem :selectable="true" :class="'right-stack ' +payment.theme" @click="navigate(Route.Detail)">
        <template #left>
            <PaymentMethodIcon :method="payment.method" :type="payment.type">
                <span v-if="payment.type !== PaymentType.Payment && payment.method !== PaymentMethod.Unknown" :class="'icon small stroke primary ' + PaymentTypeHelper.getIcon(payment.type)" />
                <span v-if="payment.status === PaymentStatus.Failed" class="icon disabled small error stroke" />
                <span v-if="payment.status === PaymentStatus.Pending || payment.status === PaymentStatus.Created" class="icon hourglass small primary stroke" />
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
            {{ $t('98148d1f-1c02-49e7-b05d-22276dd1b40c', {date: formatDate(payment.createdAt)}) }}
        </p>
        <p v-if="payment.paidAt" class="style-description-small">
            {{ $t('41334783-830b-4853-9d29-d05fb51a3f35', {date: formatDate(payment.paidAt)}) }}
        </p>
        <p v-if="payment.price && price !== null && price !== payment.price" class="style-description-small">
            {{ $t('f846548d-56a1-456d-8c7e-96ea791deac3', {price: formatPrice(payment.price)}) }}
        </p>

        <template #right>
            <span class="style-price-base" :class="{negative: (price ?? payment.price) < 0}">{{ formatPrice(price ?? payment.price) }}</span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { Payment, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PaymentTypeHelper } from '@stamhoofd/structures';
import AsyncPaymentView from '../AsyncPaymentView.vue';
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

enum Route {
    Detail = 'Detail',
}

const navigate = useNavigate();

defineRoutes([
    {
        url: props.payment.id,
        name: Route.Detail,
        show: true,
        component: AsyncPaymentView,
        paramsToProps() {
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
    },
]);

</script>
