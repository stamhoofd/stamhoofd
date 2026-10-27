<template>
    <STListItem v-long-press="(e: any) => showContextMenu(e)" :selectable="true" class="record-row right-stack left-center hover-box" @click="editRecord()" @contextmenu.prevent="showContextMenu">
        <template #left>
            <IconContainer :icon="typeIcon" :aside-icon="record.required ? null : 'help'" class="gray" />
        </template>

        <h3 class="style-title-list">
            {{ record.name }}
        </h3>
        <p v-if="description && description !== record.name.toString()" class="style-description-small">
            {{ description }}
        </p>

        <p v-if="record.filter && !record.filter.isAlwaysEnabledAndRequired" class="style-description-small">
            <span>{{ propertyFilterToString(record.filter, filterBuilder) }}</span>
        </p>

        <template #right>
            <span v-if="record.externalPermissionLevel === PermissionLevel.None" v-tooltip="$t('%172')" class="button icon tiny eye-off gray" />
            <span v-if="record.externalPermissionLevel === PermissionLevel.Read" v-tooltip="$t('%171')" class="button icon tiny no-edit gray" />
            <span class="button icon drag hover-show" @click.stop @contextmenu.stop />
            <button type="button" class="hover-show button icon more small" @click.stop="showContextMenu" />

            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@common/encoding';
import { PatchableArray } from '@common/encoding';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { RecordCategory, RecordSettings, RecordType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { propertyFilterToString } from '../../filters/UIFilter';
import IconContainer from '../../icons/IconContainer.vue';
import { usePatchMoveUpDownSingle } from '#hooks/usePatchMoveUpDown.ts';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import type { RecordEditorSettings } from '../RecordEditorSettings';
import { getRecordTypeIcon } from '../recordTypes';

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

const typeIcon = computed(() => getRecordTypeIcon(props.record.type));

const description = computed(() => {
    if (props.record.type === RecordType.Checkbox) {
        if (props.record.askComments) {
            return $t('%11k');
        }
        if (props.record.required) {
            return $t('%11l');
        }
        return $t('%115');
    }
    if (props.record.type === RecordType.ChooseOne || props.record.type === RecordType.MultipleChoice) {
        const choices = props.record.choices;
        // Few short choices read better than a count
        if (choices.length > 0 && choices.length < 4 && choices.every(c => c.name.toString().length <= 20)) {
            const names = choices.map(c => c.name.toString()).join(' · ');
            return props.record.required ? names : $t('{choices} (optioneel)', { choices: names });
        }
        if (props.record.type === RecordType.ChooseOne) {
            if (!props.record.required) {
                return $t('%11m', { count: choices.length.toString() });
            }
            return $t('%11n', { count: choices.length.toString() });
        }
        if (props.record.required) {
            return $t('%11o', { count: choices.length.toString() });
        }
        return $t('%11p', { count: choices.length.toString() });
    }
    if (props.record.type === RecordType.Email) {
        if (!props.record.required) {
            return $t('%11q');
        }
        return $t('%1FK');
    }
    if (props.record.type === RecordType.Address) {
        if (!props.record.required) {
            return $t('%11r');
        }
        return $t('%Cn');
    }
    if (props.record.type === RecordType.Phone) {
        if (!props.record.required) {
            return $t('%11s');
        }
        return $t('%wD');
    }
    if (props.record.type === RecordType.Date) {
        if (!props.record.required) {
            return $t('%11t');
        }
        return $t('%7R');
    }

    if (props.record.type === RecordType.Textarea) {
        if (!props.record.required) {
            return $t('%11u');
        }
        return $t('%11v');
    }

    if (props.record.type === RecordType.Integer) {
        if (!props.record.required) {
            return $t('%11w');
        }
        return $t('%113');
    }

    if (props.record.type === RecordType.Price) {
        if (!props.record.required) {
            return $t('%11x');
        }
        return $t('%1IP');
    }

    if (props.record.type === RecordType.Image) {
        if (!props.record.required) {
            return $t('%11y');
        }
        return $t('%la');
    }

    if (props.record.type === RecordType.File) {
        if (!props.record.required) {
            return $t('%11z');
        }
        return $t('%yU');
    }

    if (!props.record.required) {
        return $t('%120');
    }
    return $t('%121');
});

function editRecord() {
    emit('edit', props.record);
}

function toRootPatch(patch: AutoEncoderPatchType<RecordCategory>): PatchableArrayAutoEncoder<RecordCategory> {
    const array: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray();
    array.addPatch(patch);
    return array;
}

/**
 * Converts a patch of the records of the given category to a patch of the root categories
 */
function toRecordsRootPatch(category: RecordCategory, patch: PatchableArrayAutoEncoder<RecordSettings>): PatchableArrayAutoEncoder<RecordCategory> | null {
    if (props.rootCategories.find(c => c.id === category.id)) {
        return toRootPatch(RecordCategory.patch({
            id: category.id,
            records: patch,
        }));
    }

    const rootCategory = props.rootCategories.find(c => c.childCategories.find(r => r.id === category.id));
    if (!rootCategory) {
        return null;
    }

    const arr: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray();
    arr.addPatch(RecordCategory.patch({
        id: category.id,
        records: patch,
    }));

    return toRootPatch(RecordCategory.patch({
        id: rootCategory.id,
        childCategories: arr,
    }));
}

// Patches the records of the category of this record
function addPatch(patch: PatchableArrayAutoEncoder<RecordSettings>) {
    const rootPatch = toRecordsRootPatch(props.category, patch);
    if (!rootPatch) {
        console.warn('Could not find root category to patch for this record');
        return;
    }
    emit('patch', rootPatch);
}

async function deleteRecord() {
    if (!await CenteredMessage.confirm({
        title: $t('%Zn2', { name: props.record.name.toString() }),
        confirmText: $t('%CJ'),
        description: $t('%11O') + ' ' + $t('%ZnK'),
        availabilityDelay: 2_000,
    })) {
        return;
    }

    const deleteArray: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    deleteArray.addDelete(props.record.id);
    addPatch(deleteArray);
}

function moveTo(category: RecordCategory) {
    const me = props.record;

    const deleteArray: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    deleteArray.addDelete(me.id);

    const putArray: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    putArray.addPut(me);

    const deletePatch = toRecordsRootPatch(props.category, deleteArray);
    const putPatch = toRecordsRootPatch(category, putArray);
    if (!deletePatch || !putPatch) {
        console.error('Invalid move');
        return;
    }

    // Emitted as one patch: a parent that applies each patch to its props would otherwise lose the delete
    deletePatch.merge(putPatch);
    emit('patch', deletePatch);
}

function setRequired(required: boolean) {
    const patch: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    patch.addPatch(RecordSettings.patch({ id: props.record.id, required }));
    addPatch(patch);
}

/**
 * The category itself (as general question) and its child categories
 */
function getMoveToCategoryItems(category: RecordCategory): ContextMenuItem[][] {
    return [
        [
            new ContextMenuItem({
                name: $t('%123'),
                disabled: category.id === props.category.id,
                action: () => moveTo(category),
            }),
        ],
        category.childCategories.map(childCategory => new ContextMenuItem({
            name: childCategory.name.toString(),
            disabled: childCategory.id === props.category.id,
            action: () => moveTo(childCategory),
        })),
    ];
}

function showContextMenu(event: MouseEvent) {
    // With a single root category, its name adds nothing (and can be hidden from the user): list its child categories directly
    const moveItems = props.rootCategories.length === 1
        ? getMoveToCategoryItems(props.rootCategories[0])
        : [
                props.rootCategories.map(category => new ContextMenuItem({
                    name: category.name.toString(),
                    disabled: category.childCategories.length === 0 && category.id === props.category.id,
                    action: () => moveTo(category),
                    childMenu: category.childCategories.length > 0 ? new ContextMenu(getMoveToCategoryItems(category)) : undefined,
                })),
            ];
    const canMove = moveItems.some(group => group.some(item => !item.disabled));

    const menu = new ContextMenu([
        // A required checkbox means it has to be checked, which is a different setting: only available in the editor
        props.record.type !== RecordType.Checkbox
            ? [true, false].map(required => new ContextMenuItem({
                    name: required ? $t('%Qk') : $t('%14p'),
                    selected: props.record.required === required,
                    action: () => setRequired(required),
                }))
            : [],
        [
            new ContextMenuItem({
                name: $t('%11f'),
                icon: 'arrow-up',
                action: () => {
                    up();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t('%11g'),
                icon: 'arrow-down',
                action: () => {
                    down();
                    return true;
                },
            }),
            ...(canMove
                ? [
                        new ContextMenuItem({
                            icon: 'folder',
                            name: $t('%122'),
                            childMenu: new ContextMenu(moveItems),
                        }),
                    ]
                : []),
        ],
        [

            new ContextMenuItem({
                name: $t('%CJ'),
                icon: 'trash',
                destructive: true,
                action: async () => {
                    await deleteRecord();
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

</script>

<style lang="scss" scoped>
.record-row :deep(> .left) {
    gap: 12px;
}
</style>
