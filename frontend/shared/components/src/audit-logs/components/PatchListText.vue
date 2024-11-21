<template>
    <p v-for="(item, index) of items" :key="index" class="style-description-small">
        {{ getAuditLogPatchKeyName(item.key) }} <template v-if="item.name">
            van {{ item.name }}
        </template><span v-if="item.value && !item.oldValue"> toegevoegd</span><span v-if="!item.value && item.oldValue"> verwijderd</span>:
        <span v-if="item.oldValue" class="style-value-old">{{ item.oldValue }}</span>
        <span v-if="item.oldValue && item.value"> → </span>
        <span v-if="item.value" v-copyable class="style-value-new style-copyable">{{ item.value }}</span>
        <span v-if="!item.value && !item.oldValue">Toegevoegd</span>
    </p>
</template>

<script setup lang="ts">
import { AuditLogPatchItem, getAuditLogPatchKeyName } from '@stamhoofd/structures';

defineProps<{
    items: AuditLogPatchItem[];
}>();

</script>
