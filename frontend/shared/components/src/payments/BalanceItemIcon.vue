<template>
    <figure class="style-image-with-icon gray">
        <figure>
            <span class="icon" :class="getBalanceItemTypeIcon(item.type)" />
        </figure>
        <aside>
            <span v-if="item.amount > 1" class="style-bubble primary">
                {{ item.amount }}
            </span>
        </aside>
    </figure>
</template>

<script lang="ts" setup>
import type { BalanceItem, GroupedBalanceItems } from '@stamhoofd/structures';
import { getBalanceItemTypeIcon } from '@stamhoofd/structures';

withDefaults(
    defineProps<{
        item: BalanceItem | GroupedBalanceItems;
        isPayable: boolean;
    }>(),
    {
    },
);
</script>
