<template>
    <div class="st-view background category-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <h1 class="style-navigation-title with-icons" :class="{button: !!parentCategories.length}" @click="openCategorySelector">
                {{ title }}
                <span v-if="!isPublic" v-tooltip="'Deze categorie is enkel zichtbaar voor beheerders (leden die geen beheerder zijn kunnen zichtzelf niet inschrijven). Je kan dit aanpassen bij de instellingen van deze categorie.'" class="icon eye-off tiny gray" />
                <span v-if="parentCategories.length" class="button icon arrow-swap" />
            </h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <template v-if="subCategories.length > 0">
                <STList>
                    <STListItem v-if="subCategories.length > 1" :selectable="true" class="left-center" @click="openAll(true)">
                        <template #left>
                            <span class="icon group" />
                        </template>

                        <h2 class="style-title-list bolder">
                            {{ $t('%L8') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%L9') }}
                        </p>
                        <template #right>
                            <span v-if="getMemberCount() !== null" class="style-description-small">{{ getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-for="subCategory in subCategories" :key="subCategory.id" :selectable="true" @click="openCategory(subCategory)" @contextmenu.prevent="getCategoryActions({period, category: subCategory}).showMenu($event)">
                        <template #left>
                            <span class="icon folder" />
                        </template>

                        {{ subCategory.settings.name }}

                        <template #right>
                            <span v-if="subCategory.getMemberCount() !== null" class="style-description-small">{{ subCategory.getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-else-if="groups.length > 0">
                <STList>
                    <STListItem v-if="groups.length > 1" :selectable="true" class="left-center" @click="openAll(true)">
                        <template #left>
                            <span class="icon group" />
                        </template>

                        <h2 class="style-title-list bolder">
                            {{ shouldShowRegistrations ? $t('%1II') : $t('%LA') }}
                        </h2>
                        <template #right>
                            <span v-if="getMemberCount() !== null" class="style-description-small">{{ getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)" @contextmenu.prevent="getGroupActions({group, period}).showMenu($event)">
                        <template #left>
                            <GroupAvatar :group="group" />
                        </template>
                        <h3 class="style-title-list">
                            {{ group.settings.name }}
                        </h3>
                        <template #right>
                            <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ group.getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <p v-if="canCreate" class="style-button-bar">
                    <button class="button text" type="button" @click="createGroup">
                        <span class="icon add" />
                        <span>{{ $t('%1IL') }}</span>
                    </button>
                </p>
            </template>

            <p v-if="subCategories.length === 0 && groups.length === 0 && canCreate" class="info-box">
                {{ $t('%LB') }}
            </p>
            <p v-else-if="subCategories.length === 0 && groups.length === 0" class="info-box">
                {{ $t('%LC') }}
            </p>

            <p v-if="subCategories.length === 0 && groups.length === 0 && canCreate">
                <button class="button text" type="button" @click="createGroup">
                    <span class="icon add" />
                    <span>{{ $t('%LD') }}</span>
                </button>
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';

import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu.ts';


import type { Group, GroupCategory, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { GroupCategoryTree } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useGroupActions } from '../../members/useGroupActions';
import { useGroupCategoryActions } from '../../members/useGroupCategoryActions';
import { useCreateGroupView } from '../settings/hooks/useCreateGroupView';



const props = defineProps<{
    category: GroupCategory;
    period: OrganizationRegistrationPeriod;
}>();

const errors = useErrors();
const organization = useRequiredOrganization();

const show = useShow();
const navigationController = useNavigationController();
const context = useContext();

// show registrations if maximum registrations in category is 1
const shouldShowRegistrations = computed(() => props.category.settings.maximumRegistrations === 1);

const parentCategories = computed(() => [
    ...(!isRoot.value && props.period.settings.rootCategory ? [props.period.settings.rootCategory] : []),
    ...props.category.getParentCategories(props.period.availableCategories),
]);

const isPublic = computed(() => {
    return props.category.isPublic(props.period.availableCategories);
});

function openCategorySelector(event: MouseEvent) {
    if (parentCategories.value.length === 0) {
        return;
    }

    const actions: ContextMenuItem[] = [];

    for (const parent of parentCategories.value) {
        actions.unshift(new ContextMenuItem({
            name: parent.id === props.period.settings.rootCategoryId ? 'Alle inschrijvingsgroepen' : parent.settings.name,
            icon: 'category',
            action: () => {
                swapCategory(parent);
                return true;
            },
        }));
    }
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: title.value,
                icon: 'category',
                disabled: true,
                action: () => {
                    return true;
                },
            }),
            ...actions,
        ],
    ]);
    menu.show({ clickEvent: event, xPlacement: 'right', yPlacement: 'bottom' }).catch(console.error);
}

function swapCategory(category: GroupCategory) {
    show({
        components: [AsyncComponent(() => import('./CategoryView.vue'), {
            category,
            period: props.period,
        })],
        replace: navigationController.value?.components?.length ?? 1,
        animated: false,
    }).catch(console.error);
}

const reactiveCategory = computed(() => {
    const c = props.period.settings.categories.find(c => c.id === props.category.id);
    if (c) {
        return c;
    }
    return props.category;
});

function getMemberCount({ waitingList }: { waitingList?: boolean } = {}) {
    return tree.value.getMemberCount({ waitingList });
}

const tree = computed(() => {
    return GroupCategoryTree.build(reactiveCategory.value, props.period, { permissions: context.value.auth.permissions });
});

const isRoot = computed(() => props.category.id === organization.value.meta.rootCategoryId);

const name = computed(() => {
    return reactiveCategory.value.settings.name;
});

const title = computed(() => {
    return isRoot.value ? $t('%1IJ') : name.value + '';
});

const canCreate = computed(() => {
    return context.value.auth.canCreateGroupInCategory(props.category);
});

const groups = computed(() => tree.value.groups);

const subCategories = computed(() => tree.value.categories);

function openCategory(category: GroupCategory) {
    show(AsyncComponent(() => import('./CategoryView.vue'), {
        category,
        period: props.period,
    })).catch(console.error);
}

function openGroup(group: Group) {
    show(AsyncComponent(() => import('./GroupOverview.vue'), {
        group,
        period: props.period,
    })).catch(console.error);
}

function openAll(animated = true) {
    const displayedComponent = shouldShowRegistrations.value
        ? AsyncComponent(() => import('@stamhoofd/components/registrations/RegistrationsTableView.vue'), {
            category: tree.value,
            periodId: props.period.period.id,
        })
        : AsyncComponent(() => import('@stamhoofd/components/members/MembersTableView.vue'), {
            category: tree.value,
            periodId: props.period.period.id,
        });

    show({
        components: [
            displayedComponent,
        ],
        animated,
    }).catch(console.error);
}

const createGroupView = useCreateGroupView();

async function createGroup() {
    return await createGroupView(props.period, props.category);
}

// Right-click actions on the rows (saved straight to the API)
const getGroupActions = useGroupActions();
const getCategoryActions = useGroupCategoryActions();
</script>
