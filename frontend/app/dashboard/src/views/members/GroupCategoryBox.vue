<template>
    <STMenuFolder
        v-for="subcategory in category.categories"
        :id="subcategory.id"
        :key="subcategory.id"
        type="members"
        :title="subcategory.settings.name"
        :selected="checkRoute(Routes.Category, {properties: {category: subcategory, period}})"
        @open="navigate(Routes.Category, {properties: {category: subcategory, period}})"
        @contextmenu.prevent="getCategoryActions({period, category: subcategory}).showMenu($event)"
    >
        <GroupCategoryBox
            :category="subcategory"
            :period="period"
            :check-route="checkRoute"
            :navigate="navigate"
        />

        <template #right>
            <GroupCategoryMoreButton :category="subcategory" :period="period" />
        </template>
    </STMenuFolder>

    <GroupMenuItem
        v-for="group in category.groups"
        :key="group.id"
        :group="group"
        :category="category"
        :period="period"
        :check-route="checkRoute"
        :navigate="navigate"
    />

    <STMenuText v-if="category.groups.length == 0 && category.categories.length === 0">
        {{ $t('Deze categorie is leeg') }}
    </STMenuText>
</template>

<script setup lang="ts">
import type { useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import STMenuFolder from '@stamhoofd/components/menu/STMenuFolder.vue';
import STMenuText from '@stamhoofd/components/menu/STMenuText.vue';
import type { GroupCategoryTree, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import GroupMenuItem from './GroupMenuItem.vue';
import GroupCategoryMoreButton from './GroupCategoryMoreButton.vue';
import { useGroupCategoryActions } from './useGroupCategoryActions';

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

const getCategoryActions = useGroupCategoryActions();

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
