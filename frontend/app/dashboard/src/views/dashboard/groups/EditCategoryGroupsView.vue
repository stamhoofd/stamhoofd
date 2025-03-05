<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}

            <span v-if="organization" class="title-suffix">
                {{ period.period.nameShort }}
            </span>
        </h1>

        <p v-if="isRoot && enableActivities">
            {{ $t('5a1ab8d2-1bd3-4394-a474-934b57f5a78a') }} {{ period.period.name }}{{ $t('7a7d9a98-439b-4483-bcda-8a9435c55329') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <template v-if="!isRoot">
            <STInputBox v-if="canDeleteOrRename" error-fields="name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
                <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`810b66b7-f60a-4585-8cfb-ea911546a1b2`)"></STInputBox>
            <Checkbox v-if="isPlatformAdmin" v-model="locked">
                {{ $t('a5c8d3e4-55ae-4206-a670-fb03c7ae9b15') }}
                <p class="style-description-small">
                    {{ $t('cf9a1359-9e1f-4d65-986b-a22c8fc790b0') }}
                </p>
            </Checkbox>
        </template>

        <template v-if="enableActivities">
            <Checkbox v-if="categories.length === 0" v-model="limitRegistrations">
                {{ $t('e715ec2b-39f8-4edb-aea8-13430861fdcb') }}
            </Checkbox>

            <Checkbox v-if="!isRoot" v-model="isHidden">
                {{ $t('4f2ec829-89ab-4b45-a943-40639ded9332') }}
            </Checkbox>

            <p v-if="!isRoot && !isHidden && !isPublic" class="warning-box">
                {{ $t('a1042301-d590-4512-b5e1-4f4d7e556124') }}
            </p>
        </template>

        <template v-if="categories.length > 0">
            <hr><h2>{{ $t('8dcca91e-6c5f-4ae7-b40c-5d67e32a4ecf') }}</h2>
            <STList v-model="draggableCategories" :draggable="true">
                <template #item="{item: category}">
                    <GroupCategoryRow :category="category" :period="patchedPeriod" :organization="organization" @patch:period="addPatch"/>
                </template>
            </STList>
        </template>

        <template v-if="groups.length > 0 || categories.length === 0">
            <hr><h2>{{ $t('c5bd564e-223a-4f7d-acfd-a93956d7b346') }}</h2>
            <p class="error-box" v-if="categories.length > 0">
                {{ $t('3edbd4ec-de99-48f4-8c20-9a5efc4c90fa') }}
            </p>

            <STList v-model="draggableGroups" :draggable="true">
                <template #item="{item: group}">
                    <GroupRow :group="group" :period="patchedPeriod" :organization="organization" @patch:period="addPatch"/>
                </template>
            </STList>
        </template>

        <p v-if="categories.length === 0">
            <button class="button text" type="button" @click="createGroup">
                <span class="icon add"/>
                <span>{{ $t('e577b286-44a4-4e64-8375-a0bc90cc5c5a') }}</span>
            </button>
        </p>
        <p v-if="enableActivities">
            <button class="button text" type="button" @click="createCategory">
                <span class="icon add"/>
                <span v-if="groups.length === 0">{{ $t('799c9a22-4ca1-4ee3-8065-7baaa25d6d7c') }}</span>
                <span v-else>{{ $t('9a714cea-4e3f-49b2-8901-087c6a896fbd') }}</span>
            </button>
        </p>

        <div v-if="isRoot && auth.hasFullAccess()" class="container">
            <hr><h2>{{ $t('6eb0da23-36e6-4dd4-a104-13382c465263') }}</h2>
            <p>{{ $t('1fa71c9b-486b-4bc4-9d7c-dc3e6b7afb9b') }}</p>
            <button type="button" class="button text" @click="openGroupTrash">
                <span class="icon trash"/><span>{{ $t('d550f6ad-0375-49bd-8201-b0841b5d2afa') }}</span>
            </button>
        </div>

        <div v-if="canDeleteOrRename &&!isNew && !isRoot && enableActivities" class="container">
            <hr><h2>
                {{ $t('143eea60-461e-44d9-8536-dd90e3e99413') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, EditGroupView, ErrorBox, STErrorsDefault, STInputBox, STList, SaveView, useAuth, useDraggableArrayIds, useErrors, usePatch } from '@stamhoofd/components';
import { Group, GroupCategory, GroupCategorySettings, GroupGenderType, GroupPrivateSettings, GroupSettings, GroupStatus, Organization, OrganizationGenderType, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';

import { computed, getCurrentInstance, ref } from 'vue';
import GroupCategoryRow from './GroupCategoryRow.vue';
import GroupRow from './GroupRow.vue';
import GroupTrashView from './GroupTrashView.vue';

// Self reference
const instance = getCurrentInstance();
const EditCategoryGroupsView = instance!.type;

const props = defineProps<{
    organization: Organization;
    category: GroupCategory;
    isNew: boolean;
    period: OrganizationRegistrationPeriod;
    saveHandler: ((patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>);
}>();

const { patched: patchedPeriod, hasChanges, patch, addPatch } = usePatch(props.period);
const enableActivities = computed(() => props.organization.meta.modules.useActivities);
const saving = ref(false);
const pop = usePop();
const errors = useErrors();
const present = usePresent();
const auth = useAuth();
const isPlatformAdmin = auth.hasFullPlatformAccess();

const patchedCategory = computed(() => {
    const c = patchedPeriod.value.settings.categories.find(c => c.id === props.category.id);
    if (c) {
        return c;
    }
    return props.category;
});

const isRoot = computed(() => props.category.id === patchedPeriod.value.settings.rootCategoryId);
const title = computed(() => isRoot.value ? 'Inschrijvingsgroepen' : (props.isNew ? 'Nieuwe categorie' : name.value));
const name = computed({
    get: () => patchedCategory.value.settings.name,
    set: (name: string) => {
        addCategoryPatch(GroupCategory.patch({
            settings: GroupCategorySettings.patch({
                name,
            }),
        }));
    },
});
const locked = computed({
    get: () => patchedCategory.value.settings.locked,
    set: (locked: boolean) => {
        addCategoryPatch(
            GroupCategory.patch({
                settings: GroupCategorySettings.patch({
                    locked,
                }),
            }),
        );
    },
});
const canDeleteOrRename = computed(() => !locked.value || isPlatformAdmin);
const limitRegistrations = computed({
    get: () => patchedCategory.value.settings.maximumRegistrations !== null,
    set: (limitRegistrations: boolean) => {
        addCategoryPatch(
            GroupCategory.patch({
                settings: GroupCategorySettings.patch({
                    maximumRegistrations: limitRegistrations ? 1 : null,
                }),
            }),
        );
    },
});
const isHidden = computed({
    get: () => !patchedCategory.value.settings.public,
    set: (isHidden: boolean) => {
        addCategoryPatch(
            GroupCategory.patch({
                settings: GroupCategorySettings.patch({
                    public: !isHidden,
                }),
            }),
        );
    },
});
const isPublic = computed(() => patchedCategory.value.isPublic(patchedPeriod.value.settings.categories));

const categories = computed(() => {
    return patchedCategory.value.categoryIds.flatMap((id) => {
        const category = patchedPeriod.value.settings.categories.find(c => c.id === id);
        if (category) {
            return [category];
        }
        return [];
    });
});

const draggableCategories = useDraggableArrayIds(() => {
    return categories.value;
}, (patch: PatchableArray<string, string, string>) => {
    addCategoryPatch(GroupCategory.patch({
        categoryIds: patch,
    }));
});

const groups = computed(() => {
    return patchedCategory.value.groupIds.flatMap((id) => {
        const group = patchedPeriod.value.groups.find(g => g.id === id);
        if (group) {
            return [group];
        }
        return [];
    });
});

const draggableGroups = useDraggableArrayIds(() => {
    return groups.value;
}, (patch: PatchableArray<string, string, string>) => {
    addCategoryPatch(GroupCategory.patch({
        groupIds: patch,
    }));
});

function addCategoryPatch(patch: AutoEncoderPatchType<GroupCategory>) {
    const settings = OrganizationRegistrationPeriodSettings.patch({});
    patch.id = props.category.id;
    settings.categories.addPatch(patch);

    addPatch(OrganizationRegistrationPeriod.patch({
        settings,
    }));
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

async function createGroup() {
    const group = Group.create({
        organizationId: props.organization.id,
        periodId: props.organization.period.period.id,
        settings: GroupSettings.create({
            name: '',
            genderType: props.organization.meta.genderType === OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale,
        }),
        privateSettings: GroupPrivateSettings.create({}),
        status: GroupStatus.Closed,
    });

    const settings = OrganizationRegistrationPeriodSettings.patch({});

    const me = GroupCategory.patch({ id: props.category.id });
    me.groupIds.addPut(group.id);
    settings.categories.addPatch(me);

    const p = OrganizationRegistrationPeriod.patch({
        settings,
    });

    p.groups.addPut(group);

    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                group,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                    p.groups.addPatch(patch);
                    addPatch(p);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function createCategory() {
    const category = GroupCategory.create({});
    category.groupIds = patchedCategory.value.categoryIds.length === 0 ? patchedCategory.value.groupIds : [];

    const settings = OrganizationRegistrationPeriodSettings.patch({});
    settings.categories.addPut(category);

    const me = GroupCategory.patch({
        id: props.category.id,
        groupIds: [] as any,
    });

    me.categoryIds.addPut(category.id);
    settings.categories.addPatch(me);

    const p = OrganizationRegistrationPeriod.patch({
        settings,
    });

    await present({
        components: [
            new ComponentWithProperties(EditCategoryGroupsView, {
                category: category,
                organization: props.organization,
                period: patchedPeriod.value.patch(p),
                isNew: true,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(p.patch(patch));
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function openGroupTrash() {
    await present({
        components: [
            new ComponentWithProperties(GroupTrashView, { }).setDisplayStyle('popup'),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function deleteMe() {
    if (!await CenteredMessage.confirm(groups.value.length ? 'Ben je zeker dat je deze categorie en groepen wilt verwijderen?' : 'Ben je zeker dat je deze categorie wilt verwijderen?', 'Verwijderen')) {
        return;
    }
    const settings = OrganizationRegistrationPeriodSettings.patch({});
    settings.categories.addDelete(props.category.id);
    const p = OrganizationRegistrationPeriod.patch({
        settings,
    });
    await props.saveHandler(p);
    await pop({ force: true });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});
</script>
