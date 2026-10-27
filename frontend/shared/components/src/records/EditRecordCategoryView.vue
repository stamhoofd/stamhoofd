<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" :deleting="deleting" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p v-if="allowChildCategories && type === RecordEditorType.PlatformMember" class="style-description">
            {{ $t('%iE') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('%Hw') }}</a> {{ $t('%Hx') }}
        </p>
        <p v-else-if="isRootCategory" class="style-description">
            {{ $t('%Hv') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('%Hw') }}</a> {{ $t('%Hx') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <TInput v-model="name" enterkeyhint="next" :placeholder="$t(`%vC`)" error-fields="name" :error-box="errors.errorBox" :title="$t(`%vC`)" />
        </div>

        <TTextarea v-model="description" error-fields="description" :placeholder="$t(`%14p`)" :error-box="errors.errorBox" class="max" :title="$t(`%6o`)" />

        <STList v-if="(settings.toggleDefaultEnabled && allowChildCategories) || !patchedCategory.defaultEnabled">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="defaultEnabled" />
                </template>

                <h3 v-if="app === 'admin'" class="style-title-list">
                    {{ $t('%iF') }}
                </h3>
                <h3 v-else class="style-title-list">
                    {{ $t('%iG') }}
                </h3>

                <p class="style-description-small">
                    {{ $t("%iO") }}
                </p>
            </STListItem>
        </STList>

        <STInputBox :title="$t('Vragen')" class="max">
            <template #right>
                <button class="button icon add small" type="button" data-testid="records-add-button" @click="recordsBox?.showAddMenu($event)" />
            </template>
            <STCard>
                <EditRecordCategoryRecordsBox ref="recordsBox" :category="patchedCategory" :root-categories="patchedRootCategories" :settings="settings" :allow-child-categories="allowChildCategories" :saved-record-ids="savedRecordIds" :empty-description="isRootCategory ? $t('%iH') : $t('%17h')" @patch="addRootCategoriesPatch" />
            </STCard>
        </STInputBox>

        <div v-if="defaultEnabled && (hasFilters || (allowChildCategories && patchedCategory.getAllRecords().length > 1))" class="container">
            <hr><h2>{{ $t('%iK') }}</h2>
            <p v-if="!hasFilters">
                {{ $t('%iL') }}
            </p>
            <p v-else-if="allowChildCategories && patchedCategory.getAllRecords().length > 1">
                {{ $t('%iM') }}
            </p>
            <p v-else>
                {{ $t('%iN') }}
            </p>

            <PropertyFilterInput v-model="filter" :allow-optional="allowChildCategories && patchedCategory.getAllRecords().length > 1" :builder="filterBuilder" />
        </div>

        <template #buttons>
            <button class="button text only-icon-smartphone" type="button" data-testid="records-add-button" @click="recordsBox?.showAddMenu($event)">
                <span class="icon add" />
                <span>{{ $t('%SN') }}</span>
            </button>
            <button v-tooltip="$t('%jH')" class="button icon eye" type="button" @click="showExample" />
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@common/errors';
import { usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { ObjectWithRecords, PatchAnswers } from '@stamhoofd/structures';
import { PropertyFilter, RecordCategory, TranslatedString } from '@stamhoofd/structures';
import { computed, reactive, ref, useTemplateRef } from 'vue';
import { useAppContext } from '../context/appContext';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import { GroupUIFilterBuilder } from '#filters/GroupUIFilter.ts';
import PropertyFilterInput from '../filters/PropertyFilterInput.vue';
import { usePatchArray } from '#hooks/usePatchArray.ts';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import type { NavigationActions } from '../types/NavigationActions';

import type { RecordEditorSettings } from './RecordEditorSettings';
import { RecordEditorType } from './RecordEditorSettings';
import EditRecordCategoryRecordsBox from './components/EditRecordCategoryRecordsBox.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STCard from '#layout/STCard.vue';

// Define
const props = withDefaults(defineProps<{
    categoryId: string;
    rootCategories: RecordCategory[];
    saveHandler: (category: PatchableArrayAutoEncoder<RecordCategory>) => void;
    settings: RecordEditorSettings<ObjectWithRecords>;
    isNew: boolean;
    allowChildCategories: boolean;
    // ids of records that already had been saved in the database
    savedRecordIds?: Set<string>;
}>(), {
    savedRecordIds: () => new Set<string>(),
});

// Hooks
const errors = useErrors();
const { patched: patchedRootCategories, hasChanges, patch, addPatch: addRootPatch, addArrayPatch: addRootCategoriesPatch } = usePatchArray(props.rootCategories);
const pop = usePop();
const present = usePresent();

// Data
const saving = ref(false);
const deleting = ref(false);
const filterBuilder = computed(() => props.settings.filterBuilder(patchedRootCategories.value));
const app = useAppContext();
const type = props.settings.type;
const isRootCategory = computed(() => patchedRootCategories.value.some(c => c.id === props.categoryId));
const recordsBox = useTemplateRef('recordsBox');

// Computed
const patchedCategory = computed(() => {
    const rootCategory = patchedRootCategories.value.find(c => c.id === props.categoryId);
    if (rootCategory) {
        return rootCategory;
    }
    for (const r of patchedRootCategories.value) {
        for (const child of r.childCategories) {
            if (child.id === props.categoryId) {
                return child;
            }
        }
    }
    throw new Error('CategoryId not found via rootCategories: ' + props.categoryId);
});

const hasFilters = computed(() => {
    return filterBuilder.value instanceof GroupUIFilterBuilder && filterBuilder.value.builders.length > 1;
});

const title = computed(() => {
    if (isRootCategory.value) {
        return props.isNew ? $t('%10l') : $t('%17i');
    }
    return props.isNew ? $t('%LN') : $t('%17j');
});

const name = computed({
    get: () => patchedCategory.value.name,
    set: (v: string) => {
        addPatch(
            RecordCategory.patch({
                id: patchedCategory.value.id,
                name: v,
            }),
        );
    },
});

useValidation(errors.validator, () => {
    if (name.value.length < 1) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'name',
            message: $t('%11M'),
        });
    }
});

const description = computed({
    get: () => patchedCategory.value.description,
    set: (v: string) => {
        addPatch(
            RecordCategory.patch({
                id: patchedCategory.value.id,
                description: v,
            }),
        );
    },
});
const defaultEnabled = computed({
    get: () => patchedCategory.value.defaultEnabled,
    set: (v: boolean) => {
        if (v && patchedCategory.value.containsSensitiveData && !props.settings.inheritedRecordsConfiguration?.dataPermission) {
            Toast.error($t('%10m')).show();
            return;
        }

        addPatch(
            RecordCategory.patch({
                id: patchedCategory.value.id,
                defaultEnabled: v,
                filter: !defaultEnabled.value ? null : undefined,
            }),
        );
    },
});
const filter = computed({
    get: () => patchedCategory.value.filter ?? PropertyFilter.createDefault(),
    set: (v: PropertyFilter) => {
        addPatch(
            RecordCategory.patch({
                id: patchedCategory.value.id,
                filter: v,
            }),
        );
    },
});

// Methods
function getPatchParentCategories(patch: PatchableArrayAutoEncoder<RecordCategory>, categoryId = props.categoryId): PatchableArrayAutoEncoder<RecordCategory> {
    // Is it a root category?
    if (props.rootCategories.find(r => r.id === categoryId)) {
        return patch;
    }

    const parentRootCategory = props.rootCategories.find(r => !!r.childCategories.find(c => c.id === categoryId));
    if (parentRootCategory) {
        const rootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
        rootPatch.addPatch(RecordCategory.patch({
            id: parentRootCategory.id,
            childCategories: patch,
        }));
        return rootPatch;
    } else {
        console.error('Could not patch inside EditRecordCategoryView: could not find parent category', patch);
    }
    return new PatchableArray();
}

// Methods
function addPatch(patch: AutoEncoderPatchType<RecordCategory>) {
    // Is it a root category?
    if (props.rootCategories.find(r => r.id === patch.id)) {
        return addRootPatch(patch);
    }

    const parentRootCategory = props.rootCategories.find(r => !!r.childCategories.find(c => c.id === patch.id));
    if (parentRootCategory) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
        arr.addPatch(patch);
        addRootPatch(RecordCategory.patch({
            id: parentRootCategory.id,
            childCategories: arr,
        }));
    } else {
        console.error('Could not patch inside EditRecordCategoryView: could not find parent category', patch);
    }
}

async function save() {
    if (saving.value) {
        return;
    }
    errors.errorBox = null;
    saving.value = true;
    try {
        const valid = await errors.validator.validate();
        if (!valid) {
            saving.value = false;
            return;
        }
        props.saveHandler(patch.value);
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

async function deleteMe() {
    if (deleting.value) {
        return;
    }

    if (!await CenteredMessage.confirm({
        title: name.value.toString() ? $t('%Zm2', { name: name.value.toString() }) : $t('Deze vragenlijst verwijderen?'),
        confirmText: $t('%CJ'),
        description: $t('%Zmm'),
        availabilityDelay: 2_000,
    })) {
        return;
    }
    // Note we create a patch, but don't use it internally because that would throw errors. The view itszelf is not aware of the delete
    const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    arr.addDelete(props.categoryId);
    const patch = getPatchParentCategories(arr, props.categoryId);

    deleting.value = true;
    try {
        props.saveHandler(patch);
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    deleting.value = false;
}

async function showExample() {
    const reactiveValue = reactive(props.settings.exampleValue);

    // Disable filter on category level for the preview, since these cannot work
    const category = patchedCategory.value.patch({
        filter: null,
        defaultEnabled: true,
    });

    await present({
        components: [
            AsyncComponent(() => import('./FillRecordCategoryView.vue'), {
                // A child category is shown as a section of a questionnaire, not as a questionnaire of its own
                category: isRootCategory.value
                    ? category
                    : RecordCategory.create({
                            name: TranslatedString.create($t('Voorbeeld')),
                            childCategories: [category],
                        }),
                value: reactiveValue,
                saveText: $t('%1Op'),
                saveHandler: async (_patch: PatchAnswers, navigationActions: NavigationActions) => {
                    await navigationActions.pop({ force: true });
                },
                forceMarkReviewed: true,
                isPreview: true,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
