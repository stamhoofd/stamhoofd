<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" :deleting="deleting" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p v-if="allowChildCategories && type === RecordEditorType.PlatformMember" class="style-description">
            {{ $t('73a3d0bc-55a4-47e6-b650-27bb961a0721') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('0487c3b0-3f93-4344-a34a-9a9198f37023') }}</a> {{ $t('69551005-512c-4240-8e20-fd546cefafaa') }}
        </p>
        <p v-else-if="isRootCategory" class="style-description">
            {{ $t('8485e7ea-6d66-4f2c-b92a-bd44cb2f4eb4') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('0487c3b0-3f93-4344-a34a-9a9198f37023') }}</a> {{ $t('69551005-512c-4240-8e20-fd546cefafaa') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <TInput v-model="name" enterkeyhint="next" :placeholder="$t(`cbe7db4a-b65b-452b-a5d2-d369182fd28f`)" error-fields="name" :error-box="errors.errorBox" :title="$t(`cbe7db4a-b65b-452b-a5d2-d369182fd28f`)" />
        </div>

        <TTextarea v-model="description" error-fields="description" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)" :error-box="errors.errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)" />

        <STList v-if="(settings.toggleDefaultEnabled && allowChildCategories) || !patchedCategory.defaultEnabled">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="defaultEnabled" />
                </template>

                <h3 v-if="app === 'admin'" class="style-title-list">
                    {{ $t('3c283583-6a2d-497e-abe4-0e67852497b7') }}
                </h3>
                <h3 v-else class="style-title-list">
                    {{ $t('090e5afe-2d7a-4948-9f3b-56a3fb4919aa') }}
                </h3>

                <p class="style-description-small">
                    {{ $t("2a38f9c1-2904-4b14-a477-40c7ada7b743") }}
                </p>
            </STListItem>
        </STList>

        <hr>
        <p v-if="records.length === 0 && categories.length === 0" class="info-box">
            {{ isRootCategory ? $t('86e7714a-6658-4efd-9cd2-00ba243b4d10') : $t('006de532-e3d1-4567-8def-48c99477d65e') }}
        </p>

        <STList :model-value="getDraggableRecords(patchedCategory).computed.value" :draggable="true" @update:model-value="newValue => getDraggableRecords(patchedCategory).computed.value = newValue!">
            <template #item="{item: record}">
                <RecordRow :record="record" :category="patchedCategory" :root-categories="patchedRootCategories" :selectable="true" :settings="settings" @patch="addRootCategoriesPatch" @edit="editRecord($event)" />
            </template>
        </STList>

        <p class="style-button-bar">
            <button class="button text" type="button" @click="addRecord()">
                <span class="icon add" />
                <span v-if="categories.length === 0">{{ $t('00b57923-c4f1-47ab-a90a-275d192e53e8') }}</span>
                <span v-else>{{ $t('7a153144-a909-4c8c-bb35-54aac1c9aef3') }}</span>
            </button>

            <button v-if="allowChildCategories" class="button text" type="button" @click="addCategory()">
                <span class="icon add" />
                <span>{{ $t('502dc65d-e8d3-4b20-a478-a76ca9084e60') }}</span>
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
                {{ $t('e60901dd-8a37-48e1-9223-ed444f1d1d4b') }}
            </p>

            <p v-if="c.description" class="style-description-block style-em pre-wrap" v-text="c.description" />

            <STList :model-value="getDraggableRecords(c).computed.value" :draggable="true" @update:model-value="newValue => getDraggableRecords(c).computed.value = newValue!">
                <template #item="{item: record}">
                    <RecordRow :record="record" :category="c" :root-categories="patchedRootCategories" :settings="settings" :selectable="true" @patch="addRootCategoriesPatch" @edit="editRecord($event, c)" />
                </template>
            </STList>
        </div>

        <div v-if="defaultEnabled && (hasFilters || (allowChildCategories && patchedCategory.getAllRecords().length > 1))" class="container">
            <hr><h2>{{ $t('6ba4f526-8b64-4902-903b-7cb176684151') }}</h2>
            <p v-if="!hasFilters">
                {{ $t('bb4843f4-d853-4953-8869-7d9c6c12b974') }}
            </p>
            <p v-else-if="allowChildCategories && patchedCategory.getAllRecords().length > 1">
                {{ $t('d68cc8ee-9d6c-471a-a532-6ad566cf1ea1') }}
            </p>
            <p v-else>
                {{ $t('273ea198-4956-4645-a4a5-fb0566b871c5') }}
            </p>

            <PropertyFilterInput v-model="filter" :allow-optional="allowChildCategories && patchedCategory.getAllRecords().length > 1" :builder="filterBuilder" />
        </div>

        <template #toolbar>
            <button v-tooltip="$t('ee2852cb-6458-4127-8ad0-3281cc286884')" class="button icon eye" type="button" @click="showExample" />
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { ObjectWithRecords, PatchAnswers, PropertyFilter, RecordCategory, RecordSettings } from '@stamhoofd/structures';
import { Ref, computed, getCurrentInstance, reactive, ref } from 'vue';
import { useAppContext } from '../context/appContext';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { GroupUIFilterBuilder } from '../filters';
import PropertyFilterInput from '../filters/PropertyFilterInput.vue';
import { propertyFilterToString } from '../filters/UIFilter';
import { useDraggableArray, usePatchArray, usePatchMoveUpDown } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import { NavigationActions } from '../types/NavigationActions';
import EditRecordView from './EditRecordView.vue';
import FillRecordCategoryView from './FillRecordCategoryView.vue';
import { RecordEditorSettings, RecordEditorType } from './RecordEditorSettings';
import RecordRow from './components/RecordRow.vue';
import { useValidation } from '../errors/useValidation';
import { SimpleError } from '@simonbackx/simple-errors';

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
        return props.isNew ? $t(`51f9909d-c91f-455d-8cd4-ee0a1897e59d`) : $t('270c18bf-7852-4d33-809d-6567c4bd56a9');
    }
    return props.isNew ? $t(`b5822ffa-2c8b-4c88-bf4d-eb5566da56e7`) : $t('770518af-b094-4fca-bc0a-641f508895ef');
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
            message: $t('f443476a-44f5-4dda-8c39-50332319d9ec')
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
            Toast.error($t(`1f1e0d12-3960-46f9-b1e7-d8b42a89e51f`)).show();
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
                name: $t(`df8def26-260a-431b-a7fe-09fac12f97e0`),
                icon: 'settings',
                action: () => editCategory(category),
            }),
            new ContextMenuItem({
                name: $t(`d4ac382c-5394-4451-a25b-3b97f6d60168`),
                icon: 'copy',
                action: () => addCategory(category.duplicate()),
            }),
        ], [
            new ContextMenuItem({
                name: $t(`f05a29d6-2df3-45f7-a185-e4a0357fcfae`),
                icon: 'arrow-up',
                disabled: !moveRecordCategories.canMoveUp(category.id),
                action: () => {
                    moveRecordCategories.up(category.id);
                },
            }),
            new ContextMenuItem({
                name: $t(`fa6ca066-51cf-479f-be0a-adf42b328983`),
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
                name: $t(`58351618-cc4a-4785-a8c7-dfd741aa9985`),
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: $t(`ba261762-9151-487c-a3a1-deb1c59e2a14`),
                            action: async () => {
                                // Transform into a root category
                                if (!await CenteredMessage.confirm($t(`e2193879-76cd-431e-90b5-37cb1871f156`), $t(`9a384a73-d222-49f8-9203-76b8e525f1ab`), $t(`4b82085a-2d05-4172-8503-8aadd2767343`))) {
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
                                if (!await CenteredMessage.confirm($t(`e2193879-76cd-431e-90b5-37cb1871f156`), $t(`9a384a73-d222-49f8-9203-76b8e525f1ab`), $t(`a3605548-d249-489e-bf64-4d3bd3555a8c`))) {
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

    if (!await CenteredMessage.confirm($t(`95557c11-2b92-4a70-8945-99f6c6f7051c`), $t(`faae9011-c50d-4ada-aed0-c1b578782b2a`))) {
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
                saveText: $t(`bc6b2553-c28b-4e3b-aba3-4fdc2c23db6e`),
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
    return await CenteredMessage.confirm($t(`c9111e95-2f59-4164-b0af-9fbf434bf6dd`), $t(`de41b0f3-1297-4058-b390-3bfb99e3d4e0`));
};

defineExpose({
    shouldNavigateAway,
});
</script>
