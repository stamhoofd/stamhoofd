<template>
    <STMenuCategory
        v-for="category in tree.categories"
        :id="category.isRoot(period) ? null : category.id"
        :key="category.id"
        :title="category.isRoot(period) ? null : category.settings.name"
        type="members"
        :selected="checkRoute(Routes.Category, {properties: {category, period}})"
        @open="$navigate(Routes.Category, {properties: {category, period}})"
        @contextmenu.prevent="getCategoryActions({period, category}).showMenu($event)"
    >
        <GroupCategoryBox
            :category="category"
            :period="period"
            :check-route="checkRoute"
            :navigate="$navigate"
        />

        <template #right>
            <GroupCategoryMoreButton :category="category" :period="period" />
        </template>
    </STMenuCategory>

    <STMenuCategory
        v-if="period.waitingLists.length"
        id="waiting-lists"
        :title="$t('Wachtlijsten')"
        type="members"
    >
        <GroupMenuItem
            v-for="group in period.waitingLists"
            :key="group.id"
            :group="group"
            :period="period"
            :check-route="checkRoute"
            :navigate="$navigate"
        />
    </STMenuCategory>
</template>

<script setup lang="ts">
import { defineRoute, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import STMenuCategory from '@stamhoofd/components/menu/STMenuCategory.vue';
import type { Group, GroupCategory, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import GroupCategoryBox from './GroupCategoryBox.vue';
import GroupCategoryMoreButton from './GroupCategoryMoreButton.vue';
import GroupMenuItem from './GroupMenuItem.vue';
import { useGroupCategoryActions } from './useGroupCategoryActions';

const props = defineProps<{
    period: OrganizationRegistrationPeriod;
}>();

const context = useContext();
const $navigate = useNavigate();
const tree = computed(() => {
    return props.period.getCategoryTree({
        permissions: context.value?.organizationPermissions,
    });
});
const getCategoryActions = useGroupCategoryActions();

enum Routes {
    Checklist = 'checklist',
    Settings = 'settings',
    All = 'all',
    Category = 'category',
    Group = 'group',
    GroupWithPeriod = 'groupWithPeriod',
    Communication = 'berichten',
}

defineRoute({
    url: 'categorie/@slug',
    name: Routes.Category,
    params: {
        slug: String,
    },
    show: 'detail',
    component: async () => ((await import('../dashboard/groups/CategoryView.vue')).default),
    paramsToProps: (params) => {
        const category = tree.value.getAllCategories().find(g => Formatter.slug(g.settings.name) === params.slug);
        if (!category) {
            throw new Error('Category not found');
        }
        return {
            category,
            period: props.period,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug((props.category as GroupCategory).settings.name),
            },
        };
    },
});

defineRoute({
    url: '@slug',
    name: Routes.Group,
    params: {
        slug: String,
    },
    show: 'detail',
    component: async () => ((await import('../dashboard/groups/GroupOverview.vue')).default),
    paramsToProps: (params) => {
        const group = tree.value.getAllGroups().find(g => Formatter.slug(g.settings.name) === params.slug);
        if (!group) {
            throw new Error('Group not found');
        }
        return {
            group,
            period: props.period,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug((props.group as Group).settings.name),
            },
        };
    },
    isDefault: tree.value.getAllGroups().length
        ? {
                properties: {
                    group: tree.value.getAllGroups()[0],
                    period: props.period,
                },
            }
        : undefined,
},
);

const checkRoute = useCheckRoute();
</script>
