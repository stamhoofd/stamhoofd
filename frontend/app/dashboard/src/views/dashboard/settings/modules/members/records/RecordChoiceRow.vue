<template>
    <STListItem :selectable="true" @click="editChoice()">
        <h3 class="style-title-list">
            {{ choice.name }}
        </h3>
        <p v-if="choice.description" class="style-description-small">
            {{ choice.description }}
        </p>

        <template slot="right">
            <button class="button icon arrow-up gray" @click.stop="moveUp" />
            <button class="button icon arrow-down gray" @click.stop="moveDown" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { RecordChoice, RecordSettings } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditRecordChoiceView from './EditRecordChoiceView.vue';

@Component({
    components: {
        STListItem
    },
})
export default class ChoiceRow extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    choice: RecordChoice

    @Prop({ required: true })
    parentRecord: RecordSettings

    get choices(): RecordChoice[] {
        return this.parentRecord.choices
    }

    editChoice() {
        this.present(new ComponentWithProperties(EditRecordChoiceView, {
            choice: this.choice,
            parentRecord: this.parentRecord,
            isNew: false,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordChoice>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("sheet"))
    }

    addPatch(patch: PatchableArrayAutoEncoder<RecordChoice>) {
        this.$emit("patch", patch)
    }

    moveUp() {
        const index = this.choices.findIndex(c => c.id === this.choice.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray()
        p.addMove(this.choice.id, this.choices[moveTo]?.id ?? null)
        this.addPatch(p)
    }
     
    moveDown() {
        const index = this.choices.findIndex(c => c.id === this.choice.id)
        if (index == -1 || index >= this.choices.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray()
        p.addMove(this.choice.id, this.choices[moveTo]?.id ?? null)
        this.addPatch(p)
    }
}
</script>