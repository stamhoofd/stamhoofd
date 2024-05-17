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
        <p v-if="description && description != record.name" class="style-description">
            {{ description }}
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
import { usePatchMoveUpDown } from '../../hooks';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import { RecordEditorSettings } from '../RecordEditorSettings';

const props = withDefaults(
    defineProps<{
        record: RecordSettings,
        category: RecordCategory
        parentCategory?: RecordCategory | null
        rootCategories: RecordCategory[]
        settings: RecordEditorSettings<any>
    }>(),
    {
        parentCategory: null
    }
);

const emit = defineEmits<{
    // Patch patches the root categories (allows full control in case of moving records around categories)
    patch: [patch: PatchableArrayAutoEncoder<RecordCategory>],
    edit: [edit: RecordSettings]
}>();
const {up, down} = usePatchMoveUpDown(props.record.id, props.category.records, addPatch)

const description = computed(() => {
    if (props.record.type === RecordType.Checkbox) {
        if (props.record.askComments) {
            return "Aankruisvakje met tekstvak indien aangevinkt"
        }
        if (props.record.required) {
            return 'Verplicht aankruisvakje'
        }
        return 'Aankruisvakje'
    }
    if (props.record.type === RecordType.ChooseOne) {
        if (!props.record.required) {
            return 'Kies optioneel één uit ' + props.record.choices.length + ' opties'
        }
        return 'Kies één uit ' + props.record.choices.length + ' opties'
    }
    if (props.record.type === RecordType.MultipleChoice) {
        if (props.record.required) {
            return 'Kies minstens één uit ' + props.record.choices.length + ' opties'
        }
        return 'Kies optioneel meerdere keuzes uit ' + props.record.choices.length + ' opties'
    }
    if (props.record.type === RecordType.Email) {
        if (!props.record.required) {
            return 'Optioneel e-mailadres'
        }
        return 'E-mailadres'
    }
    if (props.record.type === RecordType.Address) {
        if (!props.record.required) {
            return 'Optioneel adres'
        }
        return 'Adres'
    }
    if (props.record.type === RecordType.Phone) {
        if (!props.record.required) {
            return 'Optioneel telefoonnummer'
        }
        return 'Telefoonnummer'
    }
    if (props.record.type === RecordType.Date) {
        if (!props.record.required) {
            return 'Optionele datum'
        }
        return 'Datum'
    }

    if (props.record.type === RecordType.Textarea) {
        if (!props.record.required) {
            return 'Optioneel (groot) tekstveld'
        }
        return 'Groot tekstveld'
    }

    if (!props.record.required) {
        return 'Optioneel tekstveld'
    }
    return 'Tekstveld';
})

function editRecord() {
    emit('edit', props.record)
}

// Patch a root category
function addRootPatch(patch: AutoEncoderPatchType<RecordCategory>) {
    const array: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
    array.addPatch(patch)
    emit("patch", array)
}

// Sends patch meant the root categories
function addPatch(patch: PatchableArrayAutoEncoder<RecordSettings>) {
    // Is category a root category or not?
    const rootCategory = props.rootCategories.find(c => c.id == props.category.id)
    if (rootCategory) {
        const categoryPatch = RecordCategory.patch({id: rootCategory.id})
        categoryPatch.records.merge(patch)
        addRootPatch(categoryPatch)
    } else {
        // Find the root category that contains this category
        const rootCategory = props.rootCategories.find(c => c.childCategories.find(r => r.id == props.category.id))
        if (rootCategory) {
            const childCategoryPatch = RecordCategory.patch({id: props.category.id})
            childCategoryPatch.records.merge(patch)

            const arr: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
            arr.addPatch(childCategoryPatch)

            const categoryPatch = RecordCategory.patch({id: rootCategory.id, childCategories: arr})
            addRootPatch(categoryPatch)
        } else {
            console.warn('Could not find root category to patch for this record')
        }
    }
}

function moveTo(category: RecordCategory) {
    const me = props.record

    // Delete record from current category
    const deleteArray: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    deleteArray.addDelete(me.id);
    addPatch(deleteArray);

    // Add it to the right category
    const putArray: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
    putArray.addPut(me)

    const rootCategory = props.rootCategories.find(r => r.id === category.id);
    if (rootCategory) {
        const categoryPatch = RecordCategory.patch({
            id: rootCategory.id,
            records: putArray
        })
        addRootPatch(categoryPatch)
        return;
    }

    const parentRootCategory = props.rootCategories.find(r => r.childCategories.find(rr => rr.id === category.id));
    if (!parentRootCategory) {
        console.error('Invalid move');
        return;
    }

    const childCategoryPatch: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
    childCategoryPatch.addPatch(RecordCategory.patch({
        id: category.id,
        records: putArray
    }))

    const categoryPatch = RecordCategory.patch({
        id: parentRootCategory.id,
        childCategories: childCategoryPatch
    })
    addRootPatch(categoryPatch)
}

function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: "Verplaats omhoog",
                icon: "arrow-up",
                action: () => {
                    up()
                    return true;
                }
            }),
            new ContextMenuItem({
                name: "Verplaats omlaag",
                icon: "arrow-down",
                action: () => {
                    down()
                    return true;
                }
            }),
            new ContextMenuItem({
                name: "Verplaats naar",
                childMenu: new ContextMenu([
                    props.rootCategories.map(category => {
                        return new ContextMenuItem({
                            name: category.name,
                            action: () => {
                                moveTo(category)
                            },
                            childMenu: category.childCategories.length > 0 ? new ContextMenu([
                                [
                                    new ContextMenuItem({
                                        name: 'Algemene vraag',
                                        action: () => {
                                            moveTo(category)
                                        },
                                    })
                                ],
                                category.childCategories.map(childCategory => {
                                    return new ContextMenuItem({
                                        name: childCategory.name,
                                        action: () => {
                                            moveTo(childCategory)
                                        },
                                    })
                                })
                            ]) : undefined
                        })
                    })
                ])
            }),
        ]
    ])
    menu.show({ clickEvent: event }).catch(console.error)
}


</script>
