<template>
    <STList>
        <slot name="before" />
        <!-- Only when there are records: an empty list would show a border below the last row of the `before` slot -->
        <STList v-if="category.records.length > 0" :model-value="getDraggableRecords(category).value" :draggable="true" @update:model-value="(newValue: RecordSettings[]) => getDraggableRecords(category).value = newValue">
            <template #item="{item: record}">
                <RecordRow :record="record" :category="category" :root-categories="rootCategories" :settings="settings" @patch="addRootCategoriesPatch" @edit="editRecord($event)" />
            </template>
        </STList>
    </STList>

    <EmptyStateCard v-if="showEmptyState" icon="text-style" :title="$t('Voeg een vraag toe')" :description="emptyDescription ?? undefined">
        <button class="button text" type="button" data-testid="empty-records-add-button" @click="showAddMenu($event)">
            <span class="icon add" />
            <span>{{ $t('%SN') }}</span>
        </button>
    </EmptyStateCard>

    <STInputBox v-for="c in categories" :key="c.id" :title="c.name.toString()" class="max">
        <template #right>
            <button class="button icon add small gray" type="button" @click="showRecordTypeMenu($event, c)" />
            <button class="button icon more small gray" type="button" @click="showCategoryMenu($event, c)" />
        </template>

        <p v-if="c.filter" class="info-box small selectable with-icon" @click="editCategory(c)">
            {{ propertyFilterToString(c.filter, filterBuilder) }}
            <button type="button" class="button icon edit" />
        </p>

        <EmptyStateCard v-if="c.records.length === 0" icon="text-style" :title="$t('Voeg een vraag toe')" :description="$t('Deze categorie heeft nog geen vragen')">
            <button class="button text" type="button" @click="showRecordTypeMenu($event, c)">
                <span class="icon add" />
                <span>{{ $t('%SN') }}</span>
            </button>
        </EmptyStateCard>

        <STList v-else :model-value="getDraggableRecords(c).value" :draggable="true" @update:model-value="(newValue: RecordSettings[]) => getDraggableRecords(c).value = newValue">
            <template #item="{item: record}">
                <RecordRow :record="record" :category="c" :root-categories="rootCategories" :settings="settings" @patch="addRootCategoriesPatch" @edit="editRecord($event, c)" />
            </template>
        </STList>
    </STInputBox>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@common/encoding';
import { PatchableArray } from '@common/encoding';
import { usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useDraggableArray } from '#hooks/useDraggableArray.ts';
import { usePatchMoveUpDown } from '#hooks/usePatchMoveUpDown.ts';
import type { RecordSettings, RecordType } from '@stamhoofd/structures';
import { RecordCategory } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed } from 'vue';
import { propertyFilterToString } from '../../filters/UIFilter';
import STInputBox from '../../inputs/STInputBox.vue';
import EmptyStateCard from '../../layout/EmptyStateCard.vue';
import STList from '../../layout/STList.vue';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import type { RecordEditorSettings } from '../RecordEditorSettings';
import { createRecordOfType, getRecordTypeMenuItems } from '../recordTypes';
import RecordRow from './RecordRow.vue';

/**
 * Edits the records and child categories of a category inline.
 * Rows passed in the `before` slot are listed above the records, in the same list.
 * The parent shows the add button (e.g. in the navigation bar) and opens the menu with the exposed `showAddMenu`.
 */
const props = withDefaults(defineProps<{
    category: RecordCategory;
    rootCategories: RecordCategory[];
    settings: RecordEditorSettings<any>;
    allowChildCategories: boolean;
    /**
     * When false, child categories cannot be moved out of their root category
     */
    canCreateRootCategories?: boolean;
    /**
     * Shown as an empty state with the add button when the category has no records and no child categories
     */
    emptyDescription?: string | null;
    // ids of records that already had been saved in the database
    savedRecordIds?: Set<string>;
}>(), {
    canCreateRootCategories: true,
    emptyDescription: null,
    savedRecordIds: () => new Set<string>(),
});

const emit = defineEmits<{
    // Patches the root categories
    patch: [patch: PatchableArrayAutoEncoder<RecordCategory>];
}>();

const present = usePresent();
const filterBuilder = computed(() => props.settings.filterBuilder(props.rootCategories));
const categories = computed(() => props.category.childCategories);
const showEmptyState = computed(() => props.emptyDescription !== null && props.category.records.length === 0 && categories.value.length === 0);

function addRootCategoriesPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
    emit('patch', patch);
}

function addPatch(patch: AutoEncoderPatchType<RecordCategory>) {
    const rootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;

    if (props.rootCategories.find(r => r.id === patch.id)) {
        rootPatch.addPatch(patch);
        return addRootCategoriesPatch(rootPatch);
    }

    const parentRootCategory = props.rootCategories.find(r => !!r.childCategories.find(c => c.id === patch.id));
    if (parentRootCategory) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
        arr.addPatch(patch);
        rootPatch.addPatch(RecordCategory.patch({
            id: parentRootCategory.id,
            childCategories: arr,
        }));
        return addRootCategoriesPatch(rootPatch);
    }
    console.error('Could not patch inside EditRecordCategoryRecordsBox: could not find parent category', patch);
}

const moveRecordCategories = usePatchMoveUpDown(categories, (categoriesPatch) => {
    addPatch(
        RecordCategory.patch({
            id: props.category.id,
            childCategories: categoriesPatch,
        }),
    );
});

// Mapped getters
const cachedComputers = new Map<string, Ref<RecordSettings[]>>();
function getDraggableRecords(category: RecordCategory): Ref<RecordSettings[]> {
    const cached = cachedComputers.get(category.id);
    if (cached) {
        return cached;
    }

    const c = useDraggableArray(
        () => {
            // Need a getter here because category is not a ref
            if (props.category.id === category.id) {
                return props.category.records;
            }
            return props.category.childCategories.find(cc => cc.id === category.id)?.records ?? [];
        },
        (recordsPatch) => {
            addPatch(
                RecordCategory.patch({
                    id: category.id,
                    records: recordsPatch,
                }),
            );
        },
    );
    cachedComputers.set(category.id, c);
    return c;
}

async function addRecord(type: RecordType, parent: RecordCategory = props.category) {
    const record = createRecordOfType(type);

    await present({
        components: [
            AsyncComponent(() => import('../EditRecordView.vue'), {
                record,
                isNew: true,
                settings: props.settings,
                rootCategories: props.rootCategories,
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

async function editRecord(record: RecordSettings, parent: RecordCategory = props.category) {
    await present({
        components: [
            AsyncComponent(() => import('../EditRecordView.vue'), {
                record,
                isNew: false,
                savedRecordIds: props.savedRecordIds,
                settings: props.settings,
                rootCategories: props.rootCategories,
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

async function addCategory(base?: RecordCategory) {
    const category = base ?? RecordCategory.create({});

    const childCategoryPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    childCategoryPatch.addPut(category);

    const temporaryRootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    temporaryRootPatch.addPatch(RecordCategory.patch({
        id: props.category.id,
        childCategories: childCategoryPatch,
    }));

    await present({
        components: [
            AsyncComponent(() => import('../EditRecordCategoryView.vue'), {
                categoryId: category.id,
                isNew: true,
                rootCategories: temporaryRootPatch.applyTo(props.rootCategories),
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

async function editCategory(category: RecordCategory) {
    await present({
        components: [
            AsyncComponent(() => import('../EditRecordCategoryView.vue'), {
                categoryId: category.id,
                isNew: false,
                rootCategories: props.rootCategories,
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

function moveToRoot(category: RecordCategory) {
    const childCategoryPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    childCategoryPatch.addDelete(category.id);

    const rootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    rootPatch.addPatch(RecordCategory.patch({
        id: props.category.id,
        childCategories: childCategoryPatch,
    }));

    rootPatch.addPut(category);
    addRootCategoriesPatch(rootPatch);
}

function moveToRootCategory(category: RecordCategory, target: RecordCategory) {
    const childCategoryPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    childCategoryPatch.addDelete(category.id);

    const childCategoryPatch2 = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    childCategoryPatch2.addPut(category);

    const rootPatch = new PatchableArray() as PatchableArrayAutoEncoder<RecordCategory>;
    rootPatch.addPatch(RecordCategory.patch({
        id: props.category.id,
        childCategories: childCategoryPatch,
    }));

    rootPatch.addPatch(RecordCategory.patch({
        id: target.id,
        childCategories: childCategoryPatch2,
    }));

    addRootCategoriesPatch(rootPatch);
}

async function showCategoryMenu(event: MouseEvent, category: RecordCategory) {
    const otherRootCategories = props.rootCategories.filter(c => c.id !== props.category.id);
    const canMove = props.canCreateRootCategories || otherRootCategories.length > 0;

    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('%8k'),
                icon: 'settings',
                action: () => editCategory(category),
            }),
            new ContextMenuItem({
                name: $t('%10n'),
                icon: 'copy',
                action: () => addCategory(category.duplicate()),
            }),
        ], [
            new ContextMenuItem({
                name: $t('%10o'),
                icon: 'arrow-up',
                disabled: !moveRecordCategories.canMoveUp(category.id),
                action: () => {
                    moveRecordCategories.up(category.id);
                },
            }),
            new ContextMenuItem({
                name: $t('%10p'),
                icon: 'arrow-down',
                disabled: !moveRecordCategories.canMoveDown(category.id),
                action: () => {
                    moveRecordCategories.down(category.id);
                },
            }),
        ],
        canMove
            ? [
                    new ContextMenuItem({
                        name: $t('%10q'),
                        childMenu: new ContextMenu([
                            props.canCreateRootCategories
                                ? [
                                        new ContextMenuItem({
                                            name: $t('%10r'),
                                            action: async () => {
                                                if (!await CenteredMessage.confirm($t('%10s'), $t('%10t'), $t('%10u'))) {
                                                    return;
                                                }
                                                moveToRoot(category);
                                            },
                                        }),
                                    ]
                                : [],
                            props.rootCategories.map(c => new ContextMenuItem({
                                name: c.name.toString(),
                                disabled: c.id === props.category.id,
                                action: async () => {
                                    if (!await CenteredMessage.confirm($t('%10s'), $t('%10t'), $t('%10v'))) {
                                        return;
                                    }
                                    moveToRootCategory(category, c);
                                },
                            })),
                        ]),
                    }),
                ]
            : [],
    ]);

    await menu.show({ button: event.target as HTMLElement });
}

function getAddMenuItems(): ContextMenuItem[][] {
    return [
        ...getRecordTypeMenuItems(type => addRecord(type)),
        props.allowChildCategories
            ? [
                    new ContextMenuItem({
                        name: $t('%M2'),
                        icon: 'category',
                        action: () => addCategory(),
                    }),
                ]
            : [],
    ];
}

async function showAddMenu(event: MouseEvent) {
    const menu = new ContextMenu(getAddMenuItems());
    await menu.show({ button: event.currentTarget as HTMLElement, yPlacement: 'bottom' });
}

async function showRecordTypeMenu(event: MouseEvent, parent: RecordCategory) {
    const menu = new ContextMenu(getRecordTypeMenuItems(type => addRecord(type, parent)));
    await menu.show({ button: event.currentTarget as HTMLElement, yPlacement: 'bottom' });
}

defineExpose({
    showAddMenu,
    addRecord: (type: RecordType) => addRecord(type),
    addCategory: () => addCategory(),
});
</script>
