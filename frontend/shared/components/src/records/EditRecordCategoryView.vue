<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" :deleting="deleting" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p v-if="allowChildCategories && type === RecordEditorType.PlatformMember" class="style-description">
            Een vragenlijst bevat één of meerdere persoonsgegevens, eventueel opgedeeld in categorieën. Lees <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>
        <p v-else class="style-description">
            Lees <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox title="Titel" error-fields="name" :error-box="errors.errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Titel"
                    autocomplete="off"
                    enterkeyhint="next"
                >
            </STInputBox>
        </div>

        <STInputBox title="Beschrijving" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                placeholder="Optioneel"
                autocomplete="off"
            />
        </STInputBox>

        <STList v-if="(settings.toggleDefaultEnabled && allowChildCategories) || !patchedCategory.defaultEnabled">
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="defaultEnabled" />
                </template>

                <h3 v-if="app === 'admin'" class="style-title-list">
                    Verplicht ingeschakeld voor alle leden ingeschreven bij minstens één standaard-leeftijdsgroep
                </h3>
                <h3 v-else class="style-title-list">
                    Verplicht ingeschakeld voor alle leden (behalve wachtlijsten en activiteiten)
                </h3>

                <p class="style-description-small">
                    Schakel je dit uit, dan staat deze vragenlijst standaard uit maar kan deze op lagere niveau's worden ingeschakeld. Zo behoud je maximale flexibiliteit.
                </p>
            </STListItem>
        </STList>

        <hr>

        <p v-if="records.length === 0 && categories.length === 0" class="info-box">
            Deze vragenlijst is leeg en zal nog niet getoond worden.
        </p>

        <STList :model-value="getDraggableRecords(patchedCategory).computed.value" :draggable="true" @update:model-value="newValue => getDraggableRecords(patchedCategory).computed.value = newValue!">
            <template #item="{item: record}">
                <RecordRow :record="record" :category="patchedCategory" :root-categories="patchedRootCategories" :selectable="true" :settings="settings" @patch="addRootCategoriesPatch" @edit="editRecord($event)" />
            </template>
        </STList>

        <p class="style-button-bar">
            <button class="button text" type="button" @click="addRecord()">
                <span class="icon add" />
                <span v-if="categories.length === 0">Vraag</span>
                <span v-else>Algemene vraag</span>
            </button>

            <button v-if="allowChildCategories" class="button text" type="button" @click="addCategory()">
                <span class="icon add" />
                <span>Categorie</span>
            </button>
        </p>

        <div v-for="c in categories" :key="c.id" class="container">
            <hr>
            <h2 class="style-with-button with-list">
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
                Deze categorie bevat nog geen vragen.
            </p>

            <p v-if="c.description" class="style-description-block style-em pre-wrap" v-text="c.description" />

            <STList :model-value="getDraggableRecords(c).computed.value" :draggable="true" @update:model-value="newValue => getDraggableRecords(c).computed.value = newValue!">
                <template #item="{item: record}">
                    <RecordRow :record="record" :category="c" :root-categories="patchedRootCategories" :settings="settings" :selectable="true" @patch="addRootCategoriesPatch" @edit="editRecord($event, c)" />
                </template>
            </STList>
        </div>

        <div v-if="defaultEnabled && (hasFilters || (allowChildCategories && patchedCategory.getAllRecords().length > 1))" class="container">
            <hr>
            <h2>Slim in- en uitschakelen</h2>
            <p v-if="!hasFilters">
                Je kan kiezen wanneer deze stap overgeslagen kan worden.
            </p>
            <p v-else-if="allowChildCategories && patchedCategory.getAllRecords().length > 1">
                Je kan kiezen wanneer deze vragen van toepassing zijn, en of deze stap overgeslagen kan worden.
            </p>
            <p v-else>
                Je kan kiezen wanneer deze vragen van toepassing zijn.
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
import { Toast } from '../overlays/Toast';
import { NavigationActions } from '../types/NavigationActions';
import EditRecordView from './EditRecordView.vue';
import FillRecordCategoryView from './FillRecordCategoryView.vue';
import { RecordEditorSettings, RecordEditorType } from './RecordEditorSettings';
import RecordRow from './components/RecordRow.vue';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';

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

const title = computed(() => props.isNew ? 'Nieuwe vragenlijst' : patchedCategory.value.name);
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
            Toast.error('Deze vragenlijst bevat gegevens waar je toestemming voor moet vragen. Schakel de toestemming voor gegevevensverzameling in om deze vragenlijst te activeren.').show();
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
    saving.value = true;
    try {
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
                name: 'Wijzig instellingen',
                icon: 'settings',
                action: () => editCategory(category),
            }),
            new ContextMenuItem({
                name: 'Categorie dupliceren',
                icon: 'copy',
                action: () => addCategory(category.duplicate()),
            }),
        ], [
            new ContextMenuItem({
                name: 'Verplaats naar boven',
                icon: 'arrow-up',
                disabled: !moveRecordCategories.canMoveUp(category.id),
                action: () => {
                    moveRecordCategories.up(category.id);
                },
            }),
            new ContextMenuItem({
                name: 'Verplaats naar beneden',
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
                name: 'Verplaats naar vragenlijst',
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: 'Hoofdvragenlijst',
                            action: async () => {
                                // Transform into a root category
                                if (!await CenteredMessage.confirm('Ben je zeker dat je dit wilt verplaatsen?', 'Ja, verplaatsen', 'Deze subcategorie zal worden omgezet in een vragenlijst als je de huidige vragenlijst opslaat.')) {
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
                            name: c.name,
                            disabled: c.id === props.categoryId,
                            action: async () => {
                                // Transform into a root category
                                if (!await CenteredMessage.confirm('Ben je zeker dat je dit wilt verplaatsen?', 'Ja, verplaatsen', 'Deze subcategorie zal worden verplaatst naar deze vragenlijst als je de huidige vragenlijst opslaat.')) {
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

    if (!await CenteredMessage.confirm('Weet je zeker dat je deze vragenlijst wilt verwijderen?', 'Verwijderen')) {
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
                    filter: null
                }),
                value: reactiveValue,
                saveText: 'Opslaan',
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
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});
</script>
