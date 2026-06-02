<template>
    <div class="st-menu-modern st-view members-menu">
        <STNavigationBar :title="period.period.name" />

        <main>
            <h1 v-if="true" class="adjusted">
                <span>{{ period.period.name }}</span>
            </h1>

            <div v-if="auth.hasFullAccess()" class="block">
                <div class="items">
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.All) }" @click="$navigate(Routes.All)">
                        <span class="icon team small" />
                        <span>{{ $t('Alle leden') }}</span>
                    </button>
                </div>
            </div>

            <GroupCategoryMenuBox :period="period" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import MembersTableView from '@stamhoofd/components/members/MembersTableView.vue';
import type { OrganizationRegistrationPeriod } from '@stamhoofd/structures/RegistrationPeriod.js';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import GroupCategoryMenuBox from './GroupCategoryMenuBox.vue';

const props = defineProps<{
    period: OrganizationRegistrationPeriod;
}>();

const context = useContext();
const auth = useAuth();
const $navigate = useNavigate();

const tree = computed(() => {
    return props.period.getCategoryTree({
        permissions: context.value?.organizationPermissions,
        organization: organization.value!,
    });
});

const organization = useRequiredOrganization();

const showAll = computed(() => {
    return tree.value.categories.length > 1 || tree.value.getAllGroups().length > 1;
});

enum Routes {
    All = 'allemaal',
}

defineRoutes([
    {
        url: 'allemaal',
        name: Routes.All,
        show: 'detail',
        component: MembersTableView,
        paramsToProps: () => {
            return {
                periodId: props.period.period.id,
            };
        },
        propsToParams() {
            return {
                params: {
                    slug: Formatter.slug(tree.value.settings.name),
                },
            };
        },
        isDefault: showAll.value
            ? {
                    properties: {
                        periodId: props.period.period.id,
                    },
                }
            : undefined,
    },
]);

const checkRoute = useCheckRoute();

</script>
