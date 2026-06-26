<template>
    <STListItem v-long-press="(e: any) => canShowMenu && showContextMenu(e)" :selectable="true" class="right-stack" @click="canManage && editCategory()" @contextmenu.prevent="canShowMenu && showContextMenu($event)">
        <h2 class="style-title-list">
            {{ category.settings.name }}
        </h2>
        <p class="style-description-small">
            {{ description }}
        </p>

        <template #right>
            <button v-if="canShowMenu" type="button" class="button icon more gray hide-smartphone" @click.stop.prevent="showContextMenu" @contextmenu.stop />
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import type { GroupCategory, Organization, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useGroupCategoryActions } from '../../members/useGroupCategoryActions';

const props = defineProps<{
    category: GroupCategory;
    organization: Organization;
    period: OrganizationRegistrationPeriod;
    periods: OrganizationRegistrationPeriod[];
}>();

const emit = defineEmits<{
    (e: 'patch:periods', value: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>): void;
}>();

const { showMenu: showContextMenu, editCategory, canShowMenu, canManage } = useGroupCategoryActions(
    (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => emit('patch:periods', patch),
)(props);

const childCategories = computed(() => props.category.categoryIds.map(id => props.period.settings.categories.find(c => c.id === id)!).filter(c => c));
const childGroups = computed(() => props.category.groupIds.map(id => props.period.groups.find(g => g.id === id)!).filter(g => g));

const description = computed(() => {
    if (props.category.groupIds.length === 0 && props.category.categoryIds.length === 0) {
        return $t('%Rs');
    }

    if (childGroups.value.length === 0 && childCategories.value.length === 0) {
        return $t('%Rs');
    }

    if (childGroups.value.length > 0) {
        if (childGroups.value.length > 4) {
            return $t('%1XM', { count: childGroups.value.length }) + ` (${childGroups.value.slice(0, 2).map(g => g.settings.name).join(', ')}...)`;
        }
        return $t('%1XM', { count: childGroups.value.length }) + ` (${childGroups.value.map(g => g.settings.name).join(', ')})`;
    }

    if (childCategories.value.length > 4) {
        return $t('%1aL', { count: childCategories.value.length }) + ` (${childCategories.value.slice(0, 2).map(g => g.settings.name).join(', ')}...)`;
    }

    return $t('%1aL', { count: childCategories.value.length }) + ` (${childCategories.value.map(g => g.settings.name).join(', ')})`;
});
</script>
