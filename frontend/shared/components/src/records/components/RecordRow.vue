<template>
    <STListItem v-long-press="(e: any) => showContextMenu(e)" :selectable="true" class="right-stack left-center" @click="editRecord()" @contextmenu.prevent="showContextMenu">
        <template #left>
            <img v-if="record.type === 'Text'" src="@stamhoofd/assets/images/illustrations/text-input.svg" class="style-illustration-img">
            <img v-else-if="record.type === 'Textarea'" src="@stamhoofd/assets/images/illustrations/textarea.svg" class="style-illustration-img">
            <img v-else-if="record.type === 'Checkbox'" src="@stamhoofd/assets/images/illustrations/checkbox.svg" class="style-illustration-img">
            <img v-else-if="record.type === 'ChooseOne'" src="@stamhoofd/assets/images/illustrations/radio-input.svg" class="style-illustration-img">
            <img v-else-if="record.type === 'MultipleChoice'" src="@stamhoofd/assets/images/illustrations/multiple-choice-input.svg" class="style-illustration-img">
            <img v-else-if="record.type === 'Email'" src="@stamhoofd/assets/images/illustrations/email-input.svg" class="style-illustration-img">
            <img v-else-if="record.type === 'Address'" src="@stamhoofd/assets/images/illustrations/address-input.svg" class="style-illustration-img">
            <img v-else-if="record.type === 'Date'" src="@stamhoofd/assets/images/illustrations/date-input.svg" class="style-illustration-img">
            <img v-else src="@stamhoofd/assets/images/illustrations/text-input.svg" class="style-illustration-img">
        </template>

        <h3 class="style-title-list">
            {{ record.name }}
        </h3>
        <p v-if="description && description !== record.name.toString()" class="style-description">
            {{ description }}
        </p>

        <p v-if="record.filter && !record.filter.isAlwaysEnabledAndRequired" class="style-description-small">
            <span>{{ propertyFilterToString(record.filter, filterBuilder) }}</span>
        </p>

        <template #right>
            <span v-if="record.externalPermissionLevel === PermissionLevel.None" v-tooltip="$t('%172')" class="button icon eye-off gray" />
            <span v-if="record.externalPermissionLevel === PermissionLevel.Read" v-tooltip="$t('%171')" class="button icon no-edit gray" />
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import type { RecordSettings} from '@stamhoofd/structures';
import { PermissionLevel, RecordCategory, RecordType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { propertyFilterToString } from '../../filters/UIFilter';
import { usePatchMoveUpDownSingle } from '../../hooks';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import type { RecordEditorSettings } from '../RecordEditorSettings';

const props = withDefaults(
    defineProps<{
        record: RecordSettings;
        category: RecordCategory;
        parentCategory?: RecordCategory | null;
        rootCategories: RecordCategory[];
        settings: RecordEditorSettings<any>;
    }>(),
    {
        parentCategory: null,
    },
);

const emit = defineEmits<{
    // Patch patches the root categories (allows full control in case of moving records around categories)
    patch: [patch: PatchableArrayAutoEncoder<RecordCategory>];
    edit: [edit: RecordSettings];
}>();
const { up, down } = usePatchMoveUpDownSingle(props.record.id, props.category.records, addPatch);
const filterBuilder = computed(() => props.settings.filterBuilder(props.rootCategories));

const description = computed(() => {
    if (props.record.type === RecordType.Checkbox) {
        if (props.record.askComments) {
            return $t(`%11k`);
        }
        if (props.record.required) {
            return $t(`%11l`);
        }
        return $t(`%115`);
    }
    if (props.record.type === RecordType.ChooseOne) {
        if (!props.record.required) {
            return $t(`%11m`, { count: props.record.choices.length.toString() });
        }
        return $t(`%11n`, { count: props.record.choices.length.toString() });
    }
    if (props.record.type === RecordType.MultipleChoice) {
        if (props.record.required) {
            return $t(`%11o`, { count: props.record.choices.length.toString() });
        }
        return $t(`%11p`, { count: props.record.choices.length.toString() });
    }
    if (props.record.type === RecordType.Email) {
        if (!props.record.required) {
            return $t(`%11q`);
        }
        return $t(`%1FK`);
    }
    if (props.record.type === RecordType.Address) {
        if (!props.record.required) {
            return $t(`%11r`);
        }
        return $t(`%Cn`);
    }
    if (props.record.type === RecordType.Phone) {
        if (!props.record.required) {
            return $t(`%11s`);
        }
        return $t(`%wD`);
    }
    if (props.record.type === RecordType.Date) {
        if (!props.record.required) {
            return $t(`%11t`);
        }
        return $t(`%7R`);
    }

    if (props.record.type === RecordType.Textarea) {
        if (!props.record.required) {
            return $t(`%11u`);
        }
        return $t(`%11v`);
    }

    if (props.record.type === RecordType.Integer) {
        if (!props.record.required) {
            return $t(`%11w`);
        }
        return $t(`%113`);
    }

    if (props.record.type === RecordType.Price) {
        if (!props.record.required) {
            return $t(`%11x`);
        }
        return $t(`%1IP`);
    }

    if (props.record.type === RecordType.Image) {
        if (!props.record.required) {
            return $t(`%11y`);
        }
        return $t(`%la`);
    }

    if (props.record.type === RecordType.File) {
        if (!props.record.required) {
            return $t(`%11z`);
        }
        return $t(`%yU`);
    }

    if (!props.record.required) {
        return $t(`%120`);
    }
    return $t(`%121`);
});

function editRecord() {
    emit('edit', props.record);
}

// Patch a root category
function addRootPatch(patch: AutoEncoderPatchType<RecordCategory>) {
    const array: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray();
    array.addPatch(patch);
    emit('patch', array);
}

// Sends patch meant the root categories
function addPatch(patch: PatchableArrayAutoEncoder<RecordSettings>) {
    // Is category a root category or not?
    const rootCategory = props.rootCategories.find(c => c.id === props.category.id);
    if (rootCategory) {
        const categoryPatch = RecordCategory.patch({
            id: rootCategory.id,
            records: patch,
        });
        addRootPatch(categoryPatch);
    }
    else {
        // Find the root category that contains this category
        const rootCategory = props.rootCategories.find(c => c.childCategories.find(r => r.id === props.category.id));
        if (rootCategory) {
            const childCategoryPatch = RecordCategory.patch({
                id: props.category.id,
                records: patch,
            });

            const arr: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray();
            arr.addPatch(childCategoryPatch);

            const categoryPatch = RecordCategory.patch({
                id: rootCategory.id,
                childCategories: arr,
            });
            addRootPatch(categoryPatch);
        }
        else {
            console.warn('Could not find root category to patch for this record');
        }
    }
}

function moveTo(category: RecordCategory) {
    const me = props.record;

    // Delete record from current category
    const deleteArray: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    deleteArray.addDelete(me.id);
    addPatch(deleteArray);

    // Add it to the right category
    const putArray: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    putArray.addPut(me);

    const rootCategory = props.rootCategories.find(r => r.id === category.id);
    if (rootCategory) {
        const categoryPatch = RecordCategory.patch({
            id: rootCategory.id,
            records: putArray,
        });
        addRootPatch(categoryPatch);
        return;
    }

    const parentRootCategory = props.rootCategories.find(r => !!r.childCategories.find(rr => rr.id === category.id));
    if (!parentRootCategory) {
        console.error('Invalid move');
        return;
    }

    const childCategoryPatch: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray();
    childCategoryPatch.addPatch(RecordCategory.patch({
        id: category.id,
        records: putArray,
    }));

    const categoryPatch = RecordCategory.patch({
        id: parentRootCategory.id,
        childCategories: childCategoryPatch,
    });
    addRootPatch(categoryPatch);
}

function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`%11f`),
                icon: 'arrow-up',
                action: () => {
                    up();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`%11g`),
                icon: 'arrow-down',
                action: () => {
                    down();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`%122`),
                childMenu: new ContextMenu([
                    props.rootCategories.map((category) => {
                        return new ContextMenuItem({
                            name: category.name.toString(),
                            action: () => {
                                moveTo(category);
                            },
                            childMenu: category.childCategories.length > 0
                                ? new ContextMenu([
                                    [
                                        new ContextMenuItem({
                                            name: $t(`%123`),
                                            action: () => {
                                                moveTo(category);
                                            },
                                        }),
                                    ],
                                    category.childCategories.map((childCategory) => {
                                        return new ContextMenuItem({
                                            name: childCategory.name.toString(),
                                            action: () => {
                                                moveTo(childCategory);
                                            },
                                        });
                                    }),
                                ])
                                : undefined,
                        });
                    }),
                ]),
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

</script>
