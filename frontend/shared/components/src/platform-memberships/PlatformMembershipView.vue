<template>
    <LoadingViewTransition>
        <div class="st-view">
            <STNavigationBar :title="title">
                <template #right>
                    <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('%1Pc')" @click="goBack" />
                    <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('%1Pb')" @click="goForward" />
                </template>
            </STNavigationBar>

            <main>
                <h1>
                    {{ title }}
                </h1>

                <div>
                    <PlatformMembershipBox :platform-membership="platformMembership" />
                </div>

                <hr><h2>{{ $t('%1JH') }}</h2>

                <p v-if="!sortedPayments.length" class="info-box">
                    {{ $t('%1PE') }}
                </p>

                <STList v-else>
                    <PaymentRow v-for="payment of sortedPayments" :key="payment.id" :payment="payment.payment" :payments="sortedPayments.map(b => b.payment)" :price="payment.payment.isFailed ? 0 : payment.price" />
                </STList>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import type { PlatformMembership } from '@stamhoofd/structures';
import { LoadingViewTransition } from '../containers';
import { useBackForward } from '../hooks';
import PlatformMembershipBox from './PlatformMembershipBox.vue';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import PaymentRow from '#/payments/components/PaymentRow.vue';

/**
 * Simple list with data (will not be used frequently). Can be improved in the future if necessary.
 */
const props = withDefaults(
    defineProps<{
        platformMembership: PlatformMembership;
        getNext?: ((platformMembership: PlatformMembership) => PlatformMembership) | null;
        getPrevious?: ((platformMembership: PlatformMembership) => PlatformMembership) | null;
    }>(), {
        getNext: null,
        getPrevious: null,
    },
);
const { hasNext, hasPrevious, goBack, goForward } = useBackForward('platformMembership', props);

const title = $t('%1Ny');

const sortedPayments = computed(() => {
    if (!props.platformMembership.balanceItem) {
        return [];
    }
    return props.platformMembership.balanceItem.payments.slice().sort((a, b) => Sorter.byDateValue(a.payment.paidAt ?? a.payment.createdAt, b.payment.paidAt ?? b.payment.createdAt));
});

</script>
