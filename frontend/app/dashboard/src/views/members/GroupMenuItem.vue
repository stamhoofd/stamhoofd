<template>
    <STMenuItem
        :id="group.id"
        :title="category ? group.trimmedName(category.settings.name) : group.settings.name.toString()"
        :selected="checkRoute(Routes.Group, {properties: {group, period}})"
        :right-text="group.settings.registeredMembers !== null ? formatInteger(group.settings.registeredMembers) : null"
        @click="navigate(Routes.Group, {properties: {group, period}})"
        @contextmenu.prevent="showMenu($event)"
    >
        <template #icon>
            <GroupAvatar :group="group" :allow-empty="false" />
        </template>
    </STMenuItem>
</template>

<script setup lang="ts">
import type { useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { GroupAvatar } from '@stamhoofd/components';
import STMenuItem from '@stamhoofd/components/menu/STMenuItem.vue';
import type { Group, GroupCategory, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { useGroupActions } from './useGroupActions';

enum Routes {
    Category = 'category',
    Group = 'group',
    GroupWithPeriod = 'groupWithPeriod',
}

const props = withDefaults(
    // props
    defineProps<{
        period: OrganizationRegistrationPeriod;
        group: Group;
        category?: GroupCategory | null;
        checkRoute: ReturnType<typeof useCheckRoute>;
        navigate: ReturnType<typeof useNavigate>;
    }>(),
    {
        category: null,
    },
);
defineEmits<{
    open: [value: MouseEvent];
}>();

const { showMenu } = useGroupActions()(props);

</script>
