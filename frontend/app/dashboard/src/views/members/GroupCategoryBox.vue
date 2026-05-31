<template>
    <STMenuFolder
        v-for="subcategory in category.categories"
        :id="subcategory.id"
        :key="subcategory.id"
        type="members"
        :title="subcategory.settings.name"
        :selected="checkRoute(Routes.Category, {properties: {category: subcategory, period}})"
        @open="navigate(Routes.Category, {properties: {category: subcategory, period}})"
    >
        <GroupCategoryBox
            :category="subcategory"
            :period="period"
            :check-route="checkRoute"
            :navigate="navigate"
        />

        <template #right>
            <button type="button" class="icon button small right more-in-circle" />
        </template>
    </STMenuFolder>

    <STMenuItem
        v-for="group in category.groups"
        :id="group.id"
        :key="group.id"
        :title="group.trimmedName(category.settings.name)"
        :selected="checkRoute(Routes.Group, {properties: {group, period}})"
        :right-text="group.settings.registeredMembers !== null ? formatInteger(group.settings.registeredMembers) : null"
        @click="navigate(Routes.Group, {properties: {group, period}})"
    >
        <template #icon>
            <GroupAvatar :group="group" :allow-empty="false" />
        </template>
    </STMenuItem>

    <STMenuText v-if="category.groups.length == 0 && category.categories.length === 0">
        {{ $t('Deze categorie is leeg') }}
    </STMenuText>
</template>

<script setup lang="ts">
import type { useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import type { GroupCategoryTree, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import STMenuItem from '@stamhoofd/components/menu/STMenuItem.vue';
import STMenuFolder from '@stamhoofd/components/menu/STMenuFolder.vue';
import STMenuText from '@stamhoofd/components/menu/STMenuText.vue';
import { GroupAvatar } from '@stamhoofd/components';

defineOptions({
    inheritAttrs: false,
});

enum Routes {
    Category = 'category',
    Group = 'group',
    GroupWithPeriod = 'groupWithPeriod',
}

const props = withDefaults(
    // props
    defineProps<{
        period: OrganizationRegistrationPeriod;
        category: GroupCategoryTree;
        checkRoute: ReturnType<typeof useCheckRoute>;
        navigate: ReturnType<typeof useNavigate>;
    }>(),
    {
    },
);
defineEmits<{
    open: [value: MouseEvent];
}>();

function getCategoryIcon(category: GroupCategoryTree) {
    if (category.settings.name.toLocaleLowerCase().includes('lessen') || category.settings.name.toLocaleLowerCase().includes('proefles')) {
        return 'education';
    }

    if (category.settings.name.toLocaleLowerCase().includes('activiteiten') || category.settings.name.toLocaleLowerCase().includes('kamp') || category.settings.name.toLocaleLowerCase().includes('weekend')) {
        return 'flag';
    }

    if (category.settings.name.toLocaleLowerCase().includes('betaling')) {
        return 'card';
    }

    if (category.categories.length) {
        return 'category';
    }

    return 'group';
}

</script>

<style lang="scss">
/*@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;*/

</style>
