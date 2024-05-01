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

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, LongPressDirective, STListItem } from "@stamhoofd/components";
import { RecordEditorSettings } from '@stamhoofd/structures';
import { RecordCategory, RecordSettings, RecordType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

import EditRecordView from './EditRecordView.vue';

@Component({
    components: {
        STListItem
    },
    directives: {
        longPress: LongPressDirective
    }
})
export default class RecordRow<T> extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        record: RecordSettings

    @Prop({ required: true })
        category: RecordCategory

    @Prop({ required: false, default: null })
        parentCategory: RecordCategory | null

    // This is needed so we can move a record to a totally new category via the context menu
    @Prop({ required: true })
        rootCategories: RecordCategory[]

    @Prop({ required: true })
        settings: RecordEditorSettings<T>

    get records() {
        return this.category.records
    }

    get description() {
        if (this.record.type === RecordType.Checkbox) {
            if (this.record.askComments) {
                return "Aankruisvakje met tekstvak indien aangevinkt"
            }
            if (this.record.required) {
                return 'Verplicht aankruisvakje'
            }
            return 'Aankruisvakje'
        }
        if (this.record.type === RecordType.ChooseOne) {
            if (!this.record.required) {
                return 'Kies optioneel één uit ' + this.record.choices.length + ' opties'
            }
            return 'Kies één uit ' + this.record.choices.length + ' opties'
        }
        if (this.record.type === RecordType.MultipleChoice) {
            if (this.record.required) {
                return 'Kies minstens één uit ' + this.record.choices.length + ' opties'
            }
            return 'Kies optioneel meerdere keuzes uit ' + this.record.choices.length + ' opties'
        }
        if (this.record.type === RecordType.Email) {
            if (!this.record.required) {
                return 'Optioneel e-mailadres'
            }
            return 'E-mailadres'
        }
        if (this.record.type === RecordType.Address) {
            if (!this.record.required) {
                return 'Optioneel adres'
            }
            return 'Adres'
        }
        if (this.record.type === RecordType.Phone) {
            if (!this.record.required) {
                return 'Optioneel telefoonnummer'
            }
            return 'Telefoonnummer'
        }
        if (this.record.type === RecordType.Date) {
            if (!this.record.required) {
                return 'Optionele datum'
            }
            return 'Datum'
        }

        if (this.record.type === RecordType.Textarea) {
            if (!this.record.required) {
                return 'Optioneel (groot) tekstveld'
            }
            return 'Groot tekstveld'
        }

        if (!this.record.required) {
            return 'Optioneel tekstveld'
        }
        return 'Tekstveld';
    }

    editRecord() {
        this.present(new ComponentWithProperties(EditRecordView, {
            record: this.record,
            category: this.category,
            isNew: false,
            settings: this.settings,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    // Patch a root category
    addRootPatch(patch: AutoEncoderPatchType<RecordCategory>) {
        const array: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
        array.addPatch(patch)

        console.log("add root patch", array)
        this.$emit("patch", array)
    }

    // Sends patch meant the root categories
    addPatch(patch: PatchableArrayAutoEncoder<RecordSettings>) {
        // Is category a root category or not?
        const rootCategory = this.rootCategories.find(c => c.id == this.category.id)
        if (rootCategory) {
            const categoryPatch = RecordCategory.patch({id: rootCategory.id})
            categoryPatch.records.merge(patch)
            this.addRootPatch(categoryPatch)
        } else {
            // Find the root category that contains this category
            const rootCategory = this.rootCategories.find(c => c.childCategories.find(r => r.id == this.category.id))
            if (rootCategory) {
                const childCategoryPatch = RecordCategory.patch({id: this.category.id})
                childCategoryPatch.records.merge(patch)

                const arr: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
                arr.addPatch(childCategoryPatch)

                const categoryPatch = RecordCategory.patch({id: rootCategory.id, childCategories: arr})
                this.addRootPatch(categoryPatch)
            } else {
                console.warn('Could not find root category to patch for this record')
            }
        }
    }

    moveUp() {
        const index = this.records.findIndex(c => c.id === this.record.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray()
        p.addMove(this.record.id, this.records[moveTo]?.id ?? null)
        this.addPatch(p)
    }
     
    moveDown() {
        const index = this.records.findIndex(c => c.id === this.record.id)
        if (index == -1 || index >= this.records.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray()
        p.addMove(this.record.id, this.records[moveTo]?.id ?? null)
        this.addPatch(p)
    }

    showContextMenu(event) {
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: "Verplaats omhoog",
                    icon: "arrow-up",
                    action: () => {
                        this.moveUp()
                        return true;
                    }
                }),
                new ContextMenuItem({
                    name: "Verplaats omlaag",
                    icon: "arrow-down",
                    action: () => {
                        this.moveDown()
                        return true;
                    }
                }),
            ]
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }
}
</script>