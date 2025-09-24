<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save" v-on="canDeleteOrRename && !isNew && !isRoot && enableActivities ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}

            <span class="title-suffix">
                {{ patchedPeriod.period.nameShort }}
            </span>
        </h1>

        <p v-if="isRoot && enableActivities">
            {{ $t('5ee6f9ee-1cae-4980-a7ee-c99804e36c10') }} {{ patchedPeriod.period.name }}{{ $t('b2fce682-83e3-4791-9ff2-cefd2652f2ee') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!isRoot">
            <STInputBox v-if="canDeleteOrRename" error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`bf6e5f68-2419-4001-b0bf-69b7c4685c26`)">
            </STInputBox>
            <Checkbox v-if="isPlatformAdmin" v-model="locked">
                {{ $t('3db755cd-7c47-4fbd-9797-d6ff859d9b7a') }}
                <p class="style-description-small">
                    {{ $t('4d12a29e-53e8-4cd2-99b1-47cab4e22b44') }}
                </p>
            </Checkbox>
        </template>

        <template v-if="enableActivities">
            <Checkbox v-if="categories.length === 0" v-model="limitRegistrations">
                {{ $t('177d07c8-0ee9-4b85-8363-5b8d0140134e') }}
            </Checkbox>

            <Checkbox v-if="!isRoot" v-model="isHidden">
                {{ $t('b406b04f-42cc-4df4-97f5-2f265d21d4ca') }}
            </Checkbox>

            <p v-if="!isRoot && !isHidden && !isPublic" class="warning-box">
                {{ $t('476c1b4f-4b37-420b-9b86-6793a2c0043c') }}
            </p>
        </template>

        <template v-if="categories.length > 0">
            <hr><h2>{{ $t('cb83317b-713b-400c-a753-dc944ddf0351') }}</h2>
            <STList v-model="draggableCategories" :draggable="true">
                <template #item="{item: category}">
                    <GroupCategoryRow :category="category" :periods="patchedPeriods" :period-id="periodId" :organization="organization" @patch:periods="addPeriodsArrayPatch" />
                </template>
            </STList>
        </template>

        <template v-if="groups.length > 0 || categories.length === 0">
            <hr><h2>{{ $t('edfc89fe-a16e-4789-bda9-1529f8a97f7c') }}</h2>
            <p v-if="categories.length > 0" class="error-box">
                {{ $t('dbf164b2-e1d2-4c80-8011-a5d5ce3b2221') }}
            </p>

            <STList v-model="draggableGroups" :draggable="true">
                <template #item="{item: group}">
                    <GroupRow :group="group" :period="patchedPeriod" :periods="patchedPeriods" :organization="organization" @patch:period="addPatch" @patch:other-period="addPeriodsPatch" />
                </template>
            </STList>
        </template>

        <p v-if="categories.length === 0">
            <button class="button text" type="button" @click="createGroup">
                <span class="icon add" />
                <span>{{ $t('f30e6b0a-9808-4f17-8d0b-11d9d86d12ff') }}</span>
            </button>
        </p>
        <p v-if="enableActivities">
            <button class="button text" type="button" @click="createCategory">
                <span class="icon add" />
                <span v-if="groups.length === 0">{{ $t('97ddbaef-0a49-4b53-893d-4c77dad6f52b') }}</span>
                <span v-else>{{ $t('14dcbad9-e83b-4ff9-8f39-2a059d4caaf5') }}</span>
            </button>
        </p>

        <div v-if="isRoot && auth.hasFullAccess()" class="container">
            <hr><h2>{{ $t('2a592a81-8fee-4011-8b41-83c4bcf17690') }}</h2>
            <p>{{ $t('70b46ba6-abe4-42a1-a0ab-a1b5bfd68210') }}</p>
            <button type="button" class="button text" @click="openGroupTrash">
                <span class="icon trash" /><span>{{ $t('620629c5-5e45-4c6a-ae94-a841ef7387fe') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, EditGroupView, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, useAuth, useDraggableArrayIds, useErrors, usePatchArray } from '@stamhoofd/components';
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
    periodId: string;
    periods: OrganizationRegistrationPeriod[];
    saveHandler: ((patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => Promise<void>);
}>();

const enableActivities = computed(() => props.organization.meta.modules.useActivities);
const saving = ref(false);
const pop = usePop();
const errors = useErrors();
const present = usePresent();
const auth = useAuth();
const isPlatformAdmin = auth.hasPlatformFullAccess();

const { patch: periodsPatch, patched: patchedPeriods, addArrayPatch: addPeriodsArrayPatch, addPatch: addPeriodsPatch, hasChanges } = usePatchArray(props.periods);

const patchedPeriod = computed(() => patchedPeriods.value.find(p => p.id === props.periodId)!);

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

function addPatch(patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) {
    addPeriodsPatch(OrganizationRegistrationPeriod.patch({
        ...patch,
        id: props.periodId,
    }));
}

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
        await props.saveHandler(periodsPatch.value);

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
        periodId: props.periodId,
        settings: GroupSettings.create({
            genderType: props.organization.meta.genderType === OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale,
        }),
        privateSettings: GroupPrivateSettings.create({}),
        status: GroupStatus.Closed,
    });

    const settings = OrganizationRegistrationPeriodSettings.patch({});

    const me = GroupCategory.patch({ id: props.category.id });
    me.groupIds.addPut(group.id);
    settings.categories.addPatch(me);

    const basePatch = OrganizationRegistrationPeriod.patch({
        id: props.periodId,
        settings,
    });

    basePatch.groups.addPut(group);

    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                period: patchedPeriod.value.patch(basePatch),
                groupId: group.id,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(basePatch.patch(patch));
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
                periods: props.periods,
                periodId: props.periodId,
                isNew: true,
                saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                    addPeriodsArrayPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function openGroupTrash() {
    await present({
        components: [
            new ComponentWithProperties(GroupTrashView, { period: patchedPeriod.value }).setDisplayStyle('popup'),
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
        id: props.periodId,
        settings,
    });

    const arr = new PatchableArray() as PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>;
    arr.addPatch(p);

    await props.saveHandler(arr);
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
