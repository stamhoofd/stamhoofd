<template>
    <div class="hover-box container">
        <dl class="details-grid">
            <dt>{{ $t('Lid') }}</dt>
            <dd>
                <button type="button" class="inline-link" @click="showMember(platformMembership.memberId)">
                    {{ platformMembership.member.name }}
                    <span class="icon arrow-right-small gray" />
                </button>
            </dd>
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
import { useShowMember } from '#members/hooks/useShowMember.ts';
import { useGetPlatformMembershipColumns } from './classes/PlatformMembershipColumns';

const props = defineProps<{
    platformMembership: PlatformMembership;
}>();

const columns = useGetPlatformMembershipColumns();
const showMember = useShowMember();

/**
 * Simple list with data (will not be used frequently). Can be improved in the future if necessary.
 */
const rows = computed(() => {
    return columns
        .filter(column => !column.id.startsWith('member.'))
        .map(column => ({
            id: column.id,
            label: column.name,
            value: column.getFormattedValue(props.platformMembership),
        }));
});
</script>
