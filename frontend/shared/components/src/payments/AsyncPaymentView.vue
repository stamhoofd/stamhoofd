<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <PaymentView v-if="loadedPayment" :payment="loadedPayment" />
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking';
import { Payment, PaymentGeneral } from '@stamhoofd/structures';
import { Ref, ref } from 'vue';
import { LoadingViewTransition } from '../containers';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useContext } from '../hooks';
import PaymentView from './PaymentView.vue';

const props = defineProps<{
    payment: Payment;
}>();

const context = useContext();
const errors = useErrors();
const owner = useRequestOwner();
const loadedPayment = ref(null) as Ref<PaymentGeneral | null>;
load().catch(console.error);

async function load() {
    try {
        if (props.payment instanceof PaymentGeneral) {
            loadedPayment.value = props.payment;
            return;
        }

        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/payments/${props.payment.id}`,
            decoder: PaymentGeneral as Decoder<PaymentGeneral>,
            owner,
            shouldRetry: true,
        });
        props.payment.deepSet(response.data);
        loadedPayment.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
