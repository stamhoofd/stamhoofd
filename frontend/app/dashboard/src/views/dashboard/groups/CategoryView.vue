<template>
    <div class="st-view background category-view">
        <STNavigationBar :title="title" />

        <main>
            <h1 class="style-navigation-title with-icons" :class="{button: !!parentCategories.length}" @click="openCategorySelector">
                {{ title }}
                <span v-if="!isPublic" v-tooltip="'Deze categorie is enkel zichtbaar voor beheerders (leden die geen beheerder zijn kunnen zichtzelf niet inschrijven). Je kan dit aanpassen bij de instellingen van deze categorie.'" class="icon lock small" />
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

                    <STListItem v-for="subCategory in subCategories" :key="subCategory.id" :selectable="true" @click="openCategory(subCategory)">
                        <template #left>
                            <span v-if="subCategory.categories.length" class="icon category" />
                            <span v-else class="icon category" />
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

                    <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
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
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, useNavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu.ts';
import EditGroupView from '@stamhoofd/components/groups/EditGroupView.vue';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import MembersTableView from '@stamhoofd/components/members/MembersTableView.vue';
import RegistrationsTableView from '@stamhoofd/components/registrations/RegistrationsTableView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';

import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import { Group, GroupCategory, GroupCategoryTree, GroupPrivateSettings, GroupSettings, GroupStatus, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';
import { computed } from 'vue';
import CategoryView from './CategoryView.vue';
import GroupOverview from './GroupOverview.vue';

const props = defineProps<{
    category: GroupCategory;
    period: OrganizationRegistrationPeriod;
}>();

const errors = useErrors();
const organization = useRequiredOrganization();

const present = usePresent();
const show = useShow();
const navigationController = useNavigationController();
const context = useContext();
const patchOrganizationPeriod = usePatchOrganizationPeriod();

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
        components: [new ComponentWithProperties(CategoryView, {
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
    show(new ComponentWithProperties(CategoryView, {
        category,
        period: props.period,
    })).catch(console.error);
}

function openGroup(group: Group) {
    show(new ComponentWithProperties(GroupOverview, {
        group,
        period: props.period,
    })).catch(console.error);
}

function openAll(animated = true) {
    const displayedComponent = shouldShowRegistrations.value
        ? new ComponentWithProperties(RegistrationsTableView, {
            category: tree.value,
            periodId: props.period.period.id,
        })
        : new ComponentWithProperties(MembersTableView, {
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

function createGroup() {
    const groups: PatchableArrayAutoEncoder<Group> = new PatchableArray();

    const group = Group.create({
        organizationId: organization.value.id,
        periodId: props.period.period.id,
        settings: GroupSettings.create({}),
        privateSettings: GroupPrivateSettings.create({}),
        status: GroupStatus.Closed,
    });
    const settings = OrganizationRegistrationPeriodSettings.patch({});

    const me = GroupCategory.patch({ id: props.category.id });
    me.groupIds.addPut(group.id);
    settings.categories.addPatch(me);

    groups.addPut(group);

    const basePatch = OrganizationRegistrationPeriod.patch({ groups, settings, id: props.period.id });

    const displayedComponent = new ComponentWithProperties(EditGroupView, {
        period: props.period.patch(basePatch),
        groupId: group.id,
        isNew: true,
        saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
            await patchOrganizationPeriod(basePatch.patch(patch));
        },
    });

    present({
        components: [displayedComponent],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}
</script>

<style lang="scss">
    .category-view {
        --block-width: 24px;
    }
</style>
