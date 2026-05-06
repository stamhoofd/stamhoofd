<template>
    <STListItem :key="pack.id" :selectable="selectable">
        <template #left>
            <IconContainer :icon="pack.meta.isWebshops ? 'basket' : 'group'" :class="{'gray': !pack.status.isActive, 'secundary': pack.status.isActive && pack.meta.isTrial}">
                <template #aside>
                    <span v-if="pack.meta.isTrial" v-tooltip="$t('Proefperiode')" :class="'icon trial small stroke ' + (pack.status.isActive ? 'secundary' : '')" />
                    <span v-else-if="pack.status.isActive" class="icon success small primary" />
                </template>
            </IconContainer>
        </template>
        <h3 class="style-title-list">
            {{ pack.meta.name }}
        </h3>

        <p v-if="pack.removeAt && pack.removeAt < now" class="style-description-small">
            {{ $t('Stopgezet op {date}', {date: formatDate(pack.removeAt)}) }}
        </p>

        <p v-if="!pack.validAt && pack.endDate" class="style-description-small">
            {{ $t('Geldig tot {date}', {date: formatEndDate(pack.endDate)}) }}
        </p>
        <p v-if="pack.validAt && pack.endDate" class="style-description-small">
            {{ formatDateRange(pack.meta.startDate, pack.endDate) }}
        </p>
        <p v-if="pack.validAt && !pack.endDate" class="style-description-small">
            {{ $t('Zonder einddatum') }}
        </p>

        <p v-if="$app === 'admin' && !pack.meta.allowRenew" class="style-description-small">
            {{ $t('Kan niet verlengd worden') }}
        </p>

        <p v-if="$app === 'admin' && pack.meta.allowRenew && pack.meta.keepPricesOnRenewal" class="style-description-small">
            {{ $t('Prijzen blijven behouden bij verlengen') }}
        </p>


        <p class="style-description-small" v-text="pack.meta.humanPricing" />
    </STListItem>
</template>


<script lang="ts" setup>
import type { STPackage } from '@stamhoofd/structures';
import IconContainer from '#icons/IconContainer.vue';
import { useNow } from '../hooks';

const props = withDefaults(
    defineProps<{
        pack: STPackage;
        selectable?: boolean;
    }>(),
    {
        selectable: true,
    },
);
const now = useNow()

</script>
