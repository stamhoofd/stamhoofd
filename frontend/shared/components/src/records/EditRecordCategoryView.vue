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

        <hr>
        <p v-if="records.length === 0 && categories.length === 0" class="info-box">
            {{ isRootCategory ? $t('%iH') : $t('%17h') }}
        </p>

        <STList :model-value="getDraggableRecords(patchedCategory).computed.value" :draggable="true" @update:model-value="(newValue: RecordSettings[]) => getDraggableRecords(patchedCategory).computed.value = newValue!">
            <template #item="{item: record}">
                <RecordRow :record="record" :category="patchedCategory" :root-categories="patchedRootCategories" :selectable="true" :settings="settings" @patch="addRootCategoriesPatch" @edit="editRecord($event)" />
            </template>
        </STList>

        <p class="style-button-bar">
            <button class="button text" type="button" @click="addRecord()">
                <span class="icon add" />
                <span v-if="categories.length === 0">{{ $t('%iI') }}</span>
                <span v-else>{{ $t('%123') }}</span>
            </button>

            <button v-if="allowChildCategories" class="button text" type="button" @click="addCategory()">
                <span class="icon add" />
                <span>{{ $t('%M2') }}</span>
            </button>
        </p>

        <div v-for="c in categories" :key="c.id" class="container">
            <hr><h2 class="style-with-button with-list">
                <div>
                    {{ c.name }}
                </div>
                <div>
                    <button class="icon add button gray" type="button" @click="addRecord(c)" />
                    <button class="icon more button gray" type="button" @click="showCategoryMenu($event, c)" />
                </div>
            </h2>
            <p v-if="c.filter" class="info-box selectable with-icon" @click="editCategory(c)">
                {{ propertyFilterToString(c.filter, filterBuilder) }}
                <button type="button" class="button icon edit" />
            </p>

            <p v-if="c.records.length === 0" class="info-box">
                {{ $t('%iJ') }}
            </p>

            <p v-if="c.description" class="style-description-block style-em pre-wrap" v-text="c.description" />

            <STList :model-value="getDraggableRecords(c).computed.value" :draggable="true" @update:model-value="(newValue: RecordSettings[]) => getDraggableRecords(c).computed.value = newValue!">
                <template #item="{item: record}">
                    <RecordRow :record="record" :category="c" :root-categories="patchedRootCategories" :settings="settings" :selectable="true" @patch="addRootCategoriesPatch" @edit="editRecord($event, c)" />
                </template>
            </STList>
        </div>

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

        <template #toolbar>
            <button v-tooltip="$t('%jH')" class="button icon eye" type="button" @click="showExample" />
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import type { ObjectWithRecords, PatchAnswers } from '@stamhoofd/structures';
import { PropertyFilter, RecordCategory, RecordSettings } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, getCurrentInstance, reactive, ref } from 'vue';
import { useAppContext } from '../context/appContext';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import { GroupUIFilterBuilder } from '../filters';
import PropertyFilterInput from '../filters/PropertyFilterInput.vue';
import { propertyFilterToString } from '../filters/UIFilter';
import { useDraggableArray, usePatchArray, usePatchMoveUpDown } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import type { NavigationActions } from '../types/NavigationActions';
import EditRecordView from './EditRecordView.vue';
import FillRecordCategoryView from './FillRecordCategoryView.vue';
import type { RecordEditorSettings } from './RecordEditorSettings';
import { RecordEditorType } from './RecordEditorSettings';
import RecordRow from './components/RecordRow.vue';

// Define
const props = defineProps<{
    categoryId: string;
    rootCategories: RecordCategory[];
    saveHandler: (category: PatchableArrayAutoEncoder<RecordCategory>) => void;
    settings: RecordEditorSettings<ObjectWithRecords>;
    isNew: boolean;
    allowChildCategories: boolean;
}>();

// Hooks
const errors = useErrors();
const { patched: patchedRootCategories, hasChanges, patch, addPatch: addRootPatch, addArrayPatch: addRootCategoriesPatch } = usePatchArray(props.rootCategories);
const pop = usePop();
const present = usePresent();

// Data
const saving = ref(false);
const deleting = ref(false);
const filterBuilder = computed(() => props.settings.filterBuilder(props.rootCategories));
const app = useAppContext();
const type = props.settings.type;
const isRootCategory = computed(() => patchedRootCategories.value.some(c => c.id === props.categoryId));

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
        return props.isNew ? $t(`%10l`) : $t('%17i');
    }
    return props.isNew ? $t(`%LN`) : $t('%17j');
});
const records = computed(() => patchedCategory.value.records);
const categories = computed(() => patchedCategory.value.childCategories);

const moveRecordCategories = usePatchMoveUpDown(categories, (categoriesPatch) => {
    addPatch(
        RecordCategory.patch({
            id: patchedCategory.value.id,
            childCategories: categoriesPatch,
        }),
    );
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
            message: $t('%11M')
        })
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
            Toast.error($t(`%10m`)).show();
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

// Mapped getters
const cachedComputers = new Map<string, Ref<any>>();
function getDraggableRecords(category: RecordCategory): { computed: Ref<RecordSettings[]> } {
    if (cachedComputers.has(category.id)) {
        return {
            computed: cachedComputers.get(category.id) as Ref<RecordSettings[]>,
        };
    }

    const c = useDraggableArray(
        () => {
            // Need a getter here because category is not a ref
            if (patchedCategory.value.id === category.id) {
                return patchedCategory.value.records;
            }
            return patchedCategory.value.childCategories.find(cc => cc.id === category.id)!.records;
        },
        (recordsPatch) => {
            // --
            if (category.id === props.categoryId) {
                addPatch(
                    RecordCategory.patch({
                        id: category.id,
                        records: recordsPatch,
                    }),
                );
                return;
            }

            const p = RecordCategory.patch({
                id: category.id,
                records: recordsPatch,
            });

            const arr: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray();
            arr.addPatch(p);

            addPatch(
                RecordCategory.patch({
                    id: props.categoryId,
                    childCategories: arr,
                }),
            );
        },
    );
    cachedComputers.set(category.id, c);
    return { computed: c };
}

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
    }
    else {
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
    }
    else {
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
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

async function addRecord(parent: RecordCategory = patchedCategory.value) {
    const record = RecordSettings.create({});

    await present({
        components: [
            new ComponentWithProperties(EditRecordView, {
                record,
                isNew: true,
                parentCategory: parent,
                settings: props.settings,
                rootCategories: patchedRootCategories.value,
                saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => {
                    addPatch(
                        RecordCategory.patch({
                            id: parent.id,
                            records: patch,
                        }),
                    );
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function editRecord(record: RecordSettings, parent: RecordCategory = patchedCategory.value) {
    await present({
        components: [
            new ComponentWithProperties(EditRecordView, {
                record,
                isNew: false,
                parentCategory: parent,
                settings: props.settings,
                rootCategories: patchedRootCategories.value,
                saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => {
                    addPatch(
                        RecordCategory.patch({
                            id: parent.id,
                            records: patch,
                        }),
                    );
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const Self = getCurrentInstance()!.type!;

async function addCategory(base?: RecordCategory) {
    const category = base ?? RecordCategory.create({});

    const childCategoryPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    childCategoryPatch.addPut(category);

    const temporaryRootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    temporaryRootPatch.addPatch(RecordCategory.patch({
        id: props.categoryId,
        childCategories: childCategoryPatch,
    }));

    await present({
        components: [
            new ComponentWithProperties(Self, {
                categoryId: category.id,
                isNew: true,
                rootCategories: temporaryRootPatch.applyTo(patchedRootCategories.value),
                settings: props.settings,
                allowChildCategories: false,
                saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                    addRootCategoriesPatch(temporaryRootPatch.patch(patch));
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function showCategoryMenu(event: MouseEvent, category: RecordCategory) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`%8k`),
                icon: 'settings',
                action: () => editCategory(category),
            }),
            new ContextMenuItem({
                name: $t(`%10n`),
                icon: 'copy',
                action: () => addCategory(category.duplicate()),
            }),
        ], [
            new ContextMenuItem({
                name: $t(`%10o`),
                icon: 'arrow-up',
                disabled: !moveRecordCategories.canMoveUp(category.id),
                action: () => {
                    moveRecordCategories.up(category.id);
                },
            }),
            new ContextMenuItem({
                name: $t(`%10p`),
                icon: 'arrow-down',
                disabled: !moveRecordCategories.canMoveDown(category.id),
                action: () => {
                    moveRecordCategories.down(category.id);
                },
            }),
        ],
        [

        ],
        [
            new ContextMenuItem({
                name: $t(`%10q`),
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: $t(`%10r`),
                            action: async () => {
                                // Transform into a root category
                                if (!await CenteredMessage.confirm($t(`%10s`), $t(`%10t`), $t(`%10u`))) {
                                    return;
                                }

                                // Move
                                const childCategoryPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
                                childCategoryPatch.addDelete(category.id);

                                const rootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
                                rootPatch.addPatch(RecordCategory.patch({
                                    id: props.categoryId,
                                    childCategories: childCategoryPatch,
                                }));

                                rootPatch.addPut(category);

                                addRootCategoriesPatch(rootPatch);
                            },
                        }),
                    ],
                    [
                        ...patchedRootCategories.value.map(c => new ContextMenuItem({
                            name: c.name.toString(),
                            disabled: c.id === props.categoryId,
                            action: async () => {
                                // Transform into a root category
                                if (!await CenteredMessage.confirm($t(`%10s`), $t(`%10t`), $t(`%10v`))) {
                                    return;
                                }

                                const childCategoryPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
                                childCategoryPatch.addDelete(category.id);

                                const childCategoryPatch2 = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
                                childCategoryPatch2.addPut(category);

                                const rootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
                                rootPatch.addPatch(RecordCategory.patch({
                                    id: props.categoryId,
                                    childCategories: childCategoryPatch,
                                }));

                                rootPatch.addPatch(RecordCategory.patch({
                                    id: c.id,
                                    childCategories: childCategoryPatch2,
                                }));

                                addRootCategoriesPatch(rootPatch);
                            },
                        })),
                    ],
                ]),
            }),
        ],
    ]);

    await menu.show({ button: event.target as HTMLElement });
}

async function editCategory(category: RecordCategory) {
    await present({
        components: [
            new ComponentWithProperties(Self, {
                categoryId: category.id,
                isNew: false,
                rootCategories: patchedRootCategories.value,
                settings: props.settings,
                allowChildCategories: false,
                saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                    addRootCategoriesPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function deleteMe() {
    if (deleting.value) {
        return;
    }

    if (!await CenteredMessage.confirm($t(`%10w`), $t(`%CJ`))) {
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
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    deleting.value = false;
}

async function showExample() {
    const reactiveValue = reactive(props.settings.exampleValue);
    await present({
        components: [
            new ComponentWithProperties(FillRecordCategoryView, {
                category: patchedCategory.value.patch({
                    // Disable filter on category level for the preview, since these cannot work
                    filter: null,
                    defaultEnabled: true,
                }),
                value: reactiveValue,
                saveText: $t(`%v7`),
                saveHandler: async (_patch: PatchAnswers, navigationActions: NavigationActions) => {
                    await navigationActions.pop({ force: true });
                },
                forceMarkReviewed: true,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
};

defineExpose({
    shouldNavigateAway,
});
</script>
