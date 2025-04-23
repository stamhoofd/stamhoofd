<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack left-center" @click="editRecord()" @contextmenu.prevent="showContextMenu">
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
        <p v-if="description && description !== record.name" class="style-description">
            {{ description }}
        </p>

        <p v-if="record.filter && !record.filter.isAlwaysEnabledAndRequired" class="style-description-small">
            <span>{{ propertyFilterToString(record.filter, filterBuilder) }}</span>
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { RecordCategory, RecordSettings, RecordType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { propertyFilterToString } from '../../filters/UIFilter';
import { usePatchMoveUpDownSingle } from '../../hooks';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import { RecordEditorSettings } from '../RecordEditorSettings';

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
            return $t(`6aeb461a-bb68-413d-b497-c5d861dd70d1`);
        }
        if (props.record.required) {
            return $t(`84b6d448-9e6b-4ad6-b0b1-4a5fe8141d23`);
        }
        return $t(`be247511-3af8-4006-b944-19db50d75a89`);
    }
    if (props.record.type === RecordType.ChooseOne) {
        if (!props.record.required) {
            return $t(`989879de-c980-4713-b46d-c560b3377535`, { count: props.record.choices.length.toString() });
        }
        return $t(`fe293db6-6810-4dd9-9ece-2a3f69015509`, { count: props.record.choices.length.toString() });
    }
    if (props.record.type === RecordType.MultipleChoice) {
        if (props.record.required) {
            return $t(`00a455ce-0ab7-44c6-82c0-4075f3bba399`, { count: props.record.choices.length.toString() });
        }
        return $t(`0bfe39a0-47cc-437b-b090-7e435a7f22eb`, { count: props.record.choices.length.toString() });
    }
    if (props.record.type === RecordType.Email) {
        if (!props.record.required) {
            return $t(`7213a97f-0de3-4505-87d8-bfd37ab6f427`);
        }
        return $t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`);
    }
    if (props.record.type === RecordType.Address) {
        if (!props.record.required) {
            return $t(`a3a9dd5a-3b48-413b-9993-dedc389bc26a`);
        }
        return $t(`2f10996e-ea97-4345-b997-c93198c7d67f`);
    }
    if (props.record.type === RecordType.Phone) {
        if (!props.record.required) {
            return $t(`6f650005-832a-4aac-9761-6bb0c618bcd4`);
        }
        return $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`);
    }
    if (props.record.type === RecordType.Date) {
        if (!props.record.required) {
            return $t(`2901c477-643b-46f4-918b-393356f5bebb`);
        }
        return $t(`9ee1052c-9396-4d2d-8247-97dfb45099f6`);
    }

    if (props.record.type === RecordType.Textarea) {
        if (!props.record.required) {
            return $t(`b8097548-a5c9-4d79-b0a9-dcaa595c4a62`);
        }
        return $t(`0d39fefe-652c-41e1-965f-bedcc7db5b1d`);
    }

    if (props.record.type === RecordType.Integer) {
        if (!props.record.required) {
            return $t(`3124f6c0-32a9-46d3-ad0b-8f6eb3d04941`);
        }
        return $t(`b877974f-ec5a-4e92-8ad2-3169ece7da77`);
    }

    if (props.record.type === RecordType.Price) {
        if (!props.record.required) {
            return $t(`65a518fa-c5f3-4e6b-92b5-871ae31c87ce`);
        }
        return $t(`6f3104d4-9b8f-4946-8434-77202efae9f0`);
    }

    if (props.record.type === RecordType.Image) {
        if (!props.record.required) {
            return $t(`b685fd83-8ab7-490c-866e-c17557804949`);
        }
        return $t(`f0726317-6979-41b6-bd57-7f6eb3422dc6`);
    }

    if (props.record.type === RecordType.File) {
        if (!props.record.required) {
            return $t(`bff23f5a-4b71-4af9-9638-8ca0d75a065d`);
        }
        return $t(`108e2ee2-0c29-4f5e-9c34-b9030dd369b9`);
    }

    if (!props.record.required) {
        return $t(`48305dc6-dfe3-4b93-b4d8-7fae85b0f733`);
    }
    return $t(`93ae4f29-4c4e-4fc8-b0d0-6db9a1edc0b4`);
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
                name: $t(`fa96b3e2-08bc-4ce1-9562-e09eb26bcd5b`),
                icon: 'arrow-up',
                action: () => {
                    up();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`dd2032e6-7a34-4027-a678-dbda939782c1`),
                icon: 'arrow-down',
                action: () => {
                    down();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t(`c1c5a03f-970c-4eaf-8baf-bf3195f9aded`),
                childMenu: new ContextMenu([
                    props.rootCategories.map((category) => {
                        return new ContextMenuItem({
                            name: category.name,
                            action: () => {
                                moveTo(category);
                            },
                            childMenu: category.childCategories.length > 0
                                ? new ContextMenu([
                                    [
                                        new ContextMenuItem({
                                            name: $t(`49d8a87b-542f-4522-b054-3a374ab7df1f`),
                                            action: () => {
                                                moveTo(category);
                                            },
                                        }),
                                    ],
                                    category.childCategories.map((childCategory) => {
                                        return new ContextMenuItem({
                                            name: childCategory.name,
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
