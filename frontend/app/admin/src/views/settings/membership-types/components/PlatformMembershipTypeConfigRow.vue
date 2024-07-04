<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ period.name }}
        </h2>


        <template #right>
            <span v-if="config.prices[0] && type.behaviour === PlatformMembershipTypeBehaviour.Days" class="style-description-small">{{ formatPrice(config.prices[0].pricePerDay) }} per dag</span>
            <span v-if="config.prices[0] && type.behaviour === PlatformMembershipTypeBehaviour.Period" class="style-description-small">{{ formatPrice(config.prices[0].price) }}</span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformMembershipType, PlatformMembershipTypeBehaviour, PlatformMembershipTypeConfig, RegistrationPeriod } from '@stamhoofd/structures';

defineProps<{
    type: PlatformMembershipType;
    config: PlatformMembershipTypeConfig;
    period: RegistrationPeriod
}>();
</script>
