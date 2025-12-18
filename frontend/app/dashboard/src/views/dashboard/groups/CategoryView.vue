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
                            {{ $t('379d43fb-034f-4280-bb99-ea658eaec729') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('e1f33ca8-8103-4fe9-8d84-58d960e2519c') }}
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
                            {{ shouldShowRegistrations ? $t('f068fe03-0b53-4ee2-bdc2-40dda5f6996c') : $t('33119a7d-4e82-4123-8742-dc7ec6da4a30') }}
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
                        <span>{{ $t('f52db2d7-c0f5-4f9c-b567-62f657787339') }}</span>
                    </button>
                </p>
            </template>

            <p v-if="subCategories.length === 0 && groups.length === 0 && canCreate" class="info-box">
                {{ $t('1c22a841-4402-4489-bf5d-a76b919eb4cb') }}
            </p>
            <p v-else-if="subCategories.length === 0 && groups.length === 0" class="info-box">
                {{ $t('d766699f-a294-43f4-a07e-c4eebb33fb6f') }}
            </p>

            <p v-if="subCategories.length === 0 && groups.length === 0 && canCreate">
                <button class="button text" type="button" @click="createGroup">
                    <span class="icon add" />
                    <span>{{ $t('f30e6b0a-9808-4f17-8d0b-11d9d86d12ff') }}</span>
                </button>
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, useNavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem, EditGroupView, GroupAvatar, MembersTableView, RegistrationsTableView, STErrorsDefault, STList, STListItem, STNavigationBar, useErrors } from '@stamhoofd/components';
import { useContext, useRequiredOrganization } from '@stamhoofd/components/src/hooks';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking';
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
    return isRoot.value ? $t('4dbf7584-7fe1-43d1-9bc8-a0d265865716') : name.value + '';
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
