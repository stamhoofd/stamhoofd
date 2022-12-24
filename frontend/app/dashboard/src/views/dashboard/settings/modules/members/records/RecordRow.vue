<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack left-center" @click="editRecord()" @contextmenu.prevent="showContextMenu">
        <img v-if="record.type === 'Text'" slot="left" src="~@stamhoofd/assets/images/illustrations/text-input.svg" class="style-illustration-img">
        <img v-else-if="record.type === 'Textarea'" slot="left" src="~@stamhoofd/assets/images/illustrations/textarea.svg" class="style-illustration-img">
        <img v-else-if="record.type === 'Checkbox'" slot="left" src="~@stamhoofd/assets/images/illustrations/checkbox.svg" class="style-illustration-img">
        <img v-else-if="record.type === 'ChooseOne'" slot="left" src="~@stamhoofd/assets/images/illustrations/radio-input.svg" class="style-illustration-img">
        <img v-else-if="record.type === 'MultipleChoice'" slot="left" src="~@stamhoofd/assets/images/illustrations/multiple-choice-input.svg" class="style-illustration-img">
        <img v-else-if="record.type === 'Email'" slot="left" src="~@stamhoofd/assets/images/illustrations/email-input.svg" class="style-illustration-img">
        <img v-else-if="record.type === 'Address'" slot="left" src="~@stamhoofd/assets/images/illustrations/address-input.svg" class="style-illustration-img">
        <img v-else slot="left" src="~@stamhoofd/assets/images/illustrations/text-input.svg" class="style-illustration-img">

        <h3 class="style-title-list">
            {{ record.name }}
        </h3>
        <p v-if="description && description != record.name" class="style-description">
            {{ description }}
        </p>

        <template slot="right">
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
import { Component, Mixins,Prop } from "vue-property-decorator";

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
            return 'Aankruisvakje'
        }
        if (this.record.type === RecordType.ChooseOne) {
            return 'Kies één uit ' + this.record.choices.length + ' opties'
        }
        if (this.record.type === RecordType.MultipleChoice) {
            return 'Kies meerdere uit ' + this.record.choices.length + ' opties'
        }
        if (this.record.type === RecordType.Email) {
            return 'E-mailadres'
        }
        if (this.record.type === RecordType.Address) {
            return 'Adres'
        }
        if (this.record.type === RecordType.Phone) {
            return 'Telefoonnummer'
        }

        if (this.record.type === RecordType.Textarea) {
            return 'Groot tekstveld'
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