<template>
    <div class="hover-box container">
        <hr><dl class="details-grid">
            <template v-for="{id, label, value} in rows" :key="id">
                <dt>{{ label }}</dt>
                <dd>
                    <span v-copyable class="style-copyable">{{ value }}</span>
                </dd>
            </template>
        </dl>
    </div>
</template>

<script setup lang="ts">
import type { PlatformMembership } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useGetPlatformMembershipColumns } from './classes/PlatformMembershipColumns';

const props = defineProps<{
    platformMembership: PlatformMembership;
}>();

const columns = useGetPlatformMembershipColumns();

/**
 * Simple list with data (will not be used frequently). Can be improved in the future if necessary.
 */
const rows = computed(() => {
    return columns.map(column => {
    return {
        id: column.id,
        label: column.name,
        value: column.getFormattedValue(props.platformMembership)
    };
});
}) 
</script>
