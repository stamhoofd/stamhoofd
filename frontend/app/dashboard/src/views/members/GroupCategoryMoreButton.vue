<template>
    <span class="icon button small right more-in-circle" @click.stop="showMenu" />
</template>

<script setup lang="ts">
import type { GroupCategoryTree, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { useGroupCategoryActions } from './useGroupCategoryActions';

const props = withDefaults(
    // props
    defineProps<{
        period: OrganizationRegistrationPeriod;
        category: GroupCategoryTree;
    }>(),
    {
    },
);

const { showMenu } = useGroupCategoryActions()(props);

</script>
