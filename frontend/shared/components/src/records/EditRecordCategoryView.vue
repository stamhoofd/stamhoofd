<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p class="style-description">
            Lees <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/vragenlijsten-instellen/'" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
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
                    autocomplete=""
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
                autocomplete=""
            />
        </STInputBox>

        
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
                    <button class="icon settings button gray" type="button" @click="editCategory(c)" />
                </div>
            </h2>
            <p v-if="c.filter" class="info-box selectable with-icon" @click="editCategory(c)">
                {{ c.filter.getString() }}
                <button type="button" class="button icon edit" />
            </p>

            <p v-if="c.records.length === 0" class="info-box">
                Deze categorie bevat nog geen vragen.
            </p>
                
            <STList :model-value="getDraggableRecords(c).computed.value" :draggable="true" @update:model-value="newValue => getDraggableRecords(c).computed.value = newValue!">
                <template #item="{item: record}">
                    <RecordRow :record="record" :category="c" :root-categories="patchedRootCategories" :settings="settings" :selectable="true" @patch="addRootCategoriesPatch" @edit="editRecord($event, c)" />
                </template>
            </STList>
        </div>

        <hr>
        <h2>Filters</h2>
        <p v-if="allowChildCategories">
            Je kan kiezen wanneer deze vragen van toepassing zijn, en of deze stap overgeslagen kan worden.
        </p>
        <p v-else>
            Je kan kiezen wanneer deze vragen van toepassing zijn.
        </p>

        <PropertyFilterInput v-model="filter" :allow-optional="allowChildCategories" :builder="filterBuilder" />

        <div class="container">
            <hr>
            <h2>
                Acties
            </h2>

            <button class="button secundary" type="button" @click="showExample">
                <span class="icon eye" />
                <span>Voorbeeld</span>
            </button>

            <button v-if="!isNew" class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { ObjectWithRecords, PropertyFilter, RecordCategory, RecordSettings } from '@stamhoofd/structures';
import { Ref, computed, getCurrentInstance, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import PropertyFilterInput from '../filters/PropertyFilterInput.vue';
import { useDraggableArray, usePatchArray } from '../hooks';
import EditRecordView from './EditRecordView.vue';
import { RecordEditorSettings } from './RecordEditorSettings';
import RecordRow from './components/RecordRow.vue';

// Define
const props = defineProps<{
    categoryId: string;
    rootCategories: RecordCategory[];
    saveHandler: (category: PatchableArrayAutoEncoder<RecordCategory>) => void;
    settings: RecordEditorSettings<ObjectWithRecords>;
    isNew: boolean;
    allowChildCategories: boolean
}>();

// Hooks
const errors = useErrors();
const {patched: patchedRootCategories, hasChanges, patch, addPatch: addRootPatch, addArrayPatch: addRootCategoriesPatch} = usePatchArray(props.rootCategories);
const pop = usePop();
const present = usePresent();

// Data
const saving = ref(false);
const filterBuilder = props.settings.filterBuilder(props.rootCategories)

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
    throw new Error('CategoryId not found via rootCategories: ' + props.categoryId)
});

const title = computed(() => props.isNew ? 'Nieuwe vragenlijst' : patchedCategory.value.name);
const records = computed(() => patchedCategory.value.records);
const categories = computed(() => patchedCategory.value.childCategories);
const name = computed({
    get: () => patchedCategory.value.name,
    set: (v: string) => {
        addPatch(
            RecordCategory.patch({
                id: patchedCategory.value.id,
                name: v
            })
        )
    }
})
const description = computed({
    get: () => patchedCategory.value.description,
    set: (v: string) => {
        addPatch(
            RecordCategory.patch({
                id: patchedCategory.value.id,
                description: v
            })
        )
    }
})
const filter = computed({
    get: () => patchedCategory.value.filter ?? PropertyFilter.createDefault(),
    set: (v: PropertyFilter) => {
        addPatch(
            RecordCategory.patch({
                id: patchedCategory.value.id,
                filter: v
            })
        )
    }
})

// Mapped getters
const cachedComputers = new Map<string, Ref<any>>();
function getDraggableRecords(category: RecordCategory): {computed: Ref<RecordSettings[]>} {
    if (cachedComputers.has(category.id)) {
        return {
            computed: cachedComputers.get(category.id) as Ref<RecordSettings[]>
        }
    }

    const c = useDraggableArray(
        () => {
            // Need a getter here because category is not a ref
            if (patchedCategory.value.id === category.id) {
                return patchedCategory.value.records
            }
            return patchedCategory.value.childCategories.find(cc => cc.id === category.id)!.records;
        },
        (recordsPatch) => {
            // --
            if (category.id === props.categoryId) {
                addPatch(
                    RecordCategory.patch({
                        id: category.id,
                        records: recordsPatch
                    })
                )
                return;
            }

            const p = RecordCategory.patch({
                id: category.id,
                records: recordsPatch
            })

            const arr: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
            arr.addPatch(p)
            
            addPatch(
                RecordCategory.patch({
                    id: props.categoryId,
                    childCategories: arr
                })
            )
        }
    );
    cachedComputers.set(category.id, c);
    return {computed: c};
}

// Methods
function addPatch(patch: AutoEncoderPatchType<RecordCategory>) {
    // Is it a root category?
    if (props.rootCategories.find(r => r.id === patch.id)) {
        return addRootPatch(patch)
    }

    const parentRootCategory = props.rootCategories.find(r => !!r.childCategories.find(c => c.id === patch.id))
    if (parentRootCategory) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>
        arr.addPatch(patch)
        addRootPatch(RecordCategory.patch({
            id: parentRootCategory.id,
            childCategories: arr
        }))
    } else {
        console.error('Could not patch inside EditRecordCategoryView: could not find parent category', patch)
    }
}

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        await pop({force: true});
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

async function addRecord(parent: RecordCategory = patchedCategory.value) {
    const record = RecordSettings.create({})

    await present({
        components: [
            new ComponentWithProperties(EditRecordView, {
                record,
                isNew: true,
                parentCategory: parent,
                settings: props.settings,
                saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => {
                    addPatch(
                        RecordCategory.patch({
                            id: parent.id,
                            records: patch
                        })
                    )
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function editRecord(record: RecordSettings, parent: RecordCategory = patchedCategory.value) {
    await present({
        components: [
            new ComponentWithProperties(EditRecordView, {
                record,
                isNew: false,
                parentCategory: parent,
                settings: props.settings,
                saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => {
                    addPatch(
                        RecordCategory.patch({
                            id: parent.id,
                            records: patch
                        })
                    )
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

const Self = getCurrentInstance()!.type!

async function addCategory() {
    const category = RecordCategory.create({})

    const childCategoryPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>
    childCategoryPatch.addPut(category)

    const temporaryRootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>
    temporaryRootPatch.addPatch(RecordCategory.patch({
        id: props.categoryId,
        childCategories: childCategoryPatch
    }))
    
    await present({
        components: [
            new ComponentWithProperties(Self, {
                categoryId: category.id,
                isNew: true,
                rootCategories: temporaryRootPatch.applyTo(patchedRootCategories.value),
                settings: props.settings,
                allowChildCategories: false,
                saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                    addRootCategoriesPatch(temporaryRootPatch.patch(patch))
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

function editCategory(c: RecordCategory) {

}

function deleteMe() {

}

function showExample() {

}
</script>
