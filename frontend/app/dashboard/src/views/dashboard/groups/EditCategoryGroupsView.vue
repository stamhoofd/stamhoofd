<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save" v-on="canDeleteOrRename && !isNew && !isRoot && enableActivities ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}

            <span class="title-suffix">
                {{ patchedPeriod.period.nameShort }}
            </span>
        </h1>

        <p v-if="isRoot && enableActivities">
            {{ $t('%LE') }} {{ patchedPeriod.period.name }}{{ $t('%LF') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!isRoot">
            <STInputBox v-if="canDeleteOrRename" error-fields="name" :error-box="errors.errorBox" :title="$t(`%Gq`)">
                <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%LT`)">
            </STInputBox>
            <Checkbox v-if="isPlatformAdmin" v-model="locked">
                {{ $t('%LG') }}
                <p class="style-description-small">
                    {{ $t('%LH') }}
                </p>
            </Checkbox>
        </template>

        <template v-if="enableActivities">
            <Checkbox v-if="categories.length === 0" v-model="limitRegistrations">
                {{ $t('%LI') }}
            </Checkbox>

            <Checkbox v-if="!isRoot" v-model="isHidden">
                {{ $t('%LJ') }}
            </Checkbox>

            <p v-if="!isRoot && !isHidden && !isPublic" class="warning-box">
                {{ $t('%LK') }}
            </p>
        </template>

        <template v-if="categories.length > 0">
            <hr><h2>{{ $t('%LL') }}</h2>
            <STList v-model="draggableCategories" :draggable="true">
                <template #item="{item: category}">
                    <GroupCategoryRow :category="category" :periods="patchedPeriods" :period-id="periodId" :organization="organization" @patch:periods="addPeriodsArrayPatch" />
                </template>
            </STList>
        </template>

        <template v-if="groups.length > 0 || categories.length === 0">
            <hr><h2>{{ $t('%wP') }}</h2>
            <p v-if="categories.length > 0" class="error-box">
                {{ $t('%LM') }}
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
                <span>{{ $t('%LD') }}</span>
            </button>
        </p>
        <p v-if="enableActivities">
            <button class="button text" type="button" @click="createCategory">
                <span class="icon add" />
                <span v-if="groups.length === 0">{{ $t('%LN') }}</span>
                <span v-else>{{ $t('%LO') }}</span>
            </button>
        </p>

        <div v-if="isRoot && auth.hasFullAccess()" class="container">
            <hr><h2>{{ $t('%LP') }}</h2>
            <p>{{ $t('%LQ') }}</p>
            <button type="button" class="button text" @click="openGroupTrash">
                <span class="icon trash" /><span>{{ $t('%LR') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import EditGroupView from '@stamhoofd/components/groups/EditGroupView.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useDraggableArrayIds } from '@stamhoofd/components/hooks/useDraggableArray.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatchArray } from '@stamhoofd/components/hooks/usePatchArray.ts';
import type { Organization} from '@stamhoofd/structures';
import { Group, GroupCategory, GroupCategorySettings, GroupGenderType, GroupPrivateSettings, GroupSettings, GroupStatus, OrganizationGenderType, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';

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

const patchedCategory = computed(() => patchedPeriod.value.settings.categories.find(c => c.id === props.category.id)!);

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
    patch.id = props.periodId;
    addPeriodsPatch(patch);
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
        id: props.periodId,
        settings,
    });

    const arr: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod> = new PatchableArray();
    arr.addPatch(p);

    await present({
        components: [
            new ComponentWithProperties(EditCategoryGroupsView, {
                category: category,
                organization: props.organization,
                periods: arr.applyTo(props.periods),
                periodId: props.periodId,
                isNew: true,
                saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
                    addPeriodsArrayPatch(arr);
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
