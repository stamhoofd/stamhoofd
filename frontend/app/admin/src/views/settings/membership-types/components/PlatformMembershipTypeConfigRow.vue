<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ period.name }}
        </h2>

        <p class="style-description-small">
            {{ formatStartDate(config.startDate, false, true) }} - {{ formatEndDate(config.endDate, false, true) }} {{ config.expireDate ? '(verloopt op ' + formatEndDate(config.expireDate, false, true)+')' : '' }}
        </p>

        <template #right>
            <span v-if="config.prices[0] && type.behaviour === PlatformMembershipTypeBehaviour.Days" class="style-description-small">{{ formatPrice(config.prices[0].pricePerDay) }} {{ $t('42ac723d-9e5f-4324-a2b9-f14ceeba10d8') }}</span>
            <span v-if="config.prices[0] && type.behaviour === PlatformMembershipTypeBehaviour.Period" class="style-description-small">{{ $price !== undefined ? formatPrice($price) : '?' }}</span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, RegistrationPeriod } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    type: PlatformMembershipType;
    config: PlatformMembershipTypeConfig;
    period: RegistrationPeriod;
}>();

const $price = computed(() => props.config.prices[0].prices.get('')?.price);
</script>
