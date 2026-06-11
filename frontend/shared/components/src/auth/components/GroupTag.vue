<template>
    <span v-if="group.closed && !group.notYetOpen" class="style-tag error">{{ $t('Gesloten') }}</span>
    <template v-else>
        <span v-if="group.notYetOpen" class="style-tag error">{{ $t('Nog niet geopend') }}</span>
        <template v-if="remainingStock !== null">
            <span v-if="remainingStock > 0" class="style-tag warn">
                {{ remainingStock !== 1 ? $t('Nog {count} plaatsen', { count: remainingStock }) : $t('Nog één plaats') }}
            </span>
            <span v-else-if="group.waitingList !== null" class="style-tag error">
                {{ $t('Wachtlijst (volzet)') }}
            </span>
            <span v-else class="style-tag error">
                {{ $t('Volzet') }}
            </span>
            <span v-if="preRegistrations && remainingStock > 0" class="style-tag warn">{{ $t('Voorinschrijvingen') }}</span>
        </template>
        <span v-else-if="preRegistrations" class="style-tag warn">{{ $t('Voorinschrijvingen') }}</span>
        <span v-else-if="allWaitingList" class="style-tag error">{{ $t('Wachtlijst') }}</span>
    </template>
</template>

<script setup lang="ts">
import { Group, WaitingListType } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    group: Group
}>();

const remainingStock = computed(() => props.group.settings.getRemainingStockIncludingPrices(props.group));
const preRegistrations = computed(() => props.group.activePreRegistrationDate !== null);
const allWaitingList = computed(() => props.group.settings.waitingListType === WaitingListType.All);
</script>
