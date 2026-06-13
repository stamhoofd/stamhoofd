<template>
    <STListItem :selectable="selectable">
        <template #left>
            <IconContainer :icon="pack.meta.isWebshops ? 'basket' : 'group'" :class="{'gray': !pack.status.isActive, 'secundary': pack.status.isActive && pack.meta.isTrial}">
                <template #aside>
                    <span v-if="pack.meta.isTrial" v-tooltip="$t('%1IH')" :class="'icon trial small stroke ' + (pack.status.isActive ? 'secundary' : '')" />
                    <span v-else-if="pack.status.isActive" class="icon success small primary" />
                </template>
            </IconContainer>
        </template>
        <h3 class="style-title-list">
            {{ pack.meta.name }}
        </h3>
        <p class="style-description-small" v-text="pack.meta.humanPricing" />

        <p v-if="pack.endDate && pack.endDate <= now" class="style-description-small">
            {{ $t('%1TC', {date: formatEndDate(pack.endDate)}) }}
        </p>

        <p v-if="pack.meta.startDate > now" class="style-description-small">
            {{ $t('%kR', {date: formatStartDate(pack.meta.startDate)}) }}
        </p>

        <p v-if="!pack.validAt && pack.endDate" class="style-description-small">
            {{ $t('%1QT', {date: formatEndDate(pack.endDate)}) }}
        </p>
        <p v-if="pack.validAt && pack.endDate" class="style-description-small">
            {{ capitalizeFirstLetter(formatDateRange(pack.meta.startDate, pack.endDate)) }}
        </p>
        <p v-if="pack.validAt && !pack.endDate" class="style-description-small">
            {{ $t('%1TN') }}
        </p>

        <p v-if="$app === 'admin' && !pack.meta.allowRenew" class="style-description-small">
            {{ $t('%1SO') }}
        </p>

        <p v-if="$app === 'admin' && pack.meta.allowRenew && pack.meta.keepPricesOnRenewal" class="style-description-small">
            {{ $t('%1RT') }}
        </p>

        <template #right>
            <slot name="right" />
        </template>
    </STListItem>
</template>


<script lang="ts" setup>
import type { STPackage } from '@stamhoofd/structures';
import IconContainer from '#icons/IconContainer.vue';
import { useNow } from '#hooks/useNow.ts';

const props = withDefaults(
    defineProps<{
        pack: STPackage;
        selectable?: boolean;
    }>(),
    {
        selectable: false,
    },
);
const now = useNow()

</script>
