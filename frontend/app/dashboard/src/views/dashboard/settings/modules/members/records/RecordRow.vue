<template>
    <STListItem :selectable="true" class="right-stack" @click="editRecord()">
        <h3 class="style-title-list">
            {{ record.name }}
        </h3>


        <template slot="right">
            <button class="button icon arrow-up gray" type="button" @click.stop="moveUp" />
            <button class="button icon arrow-down gray" type="button" @click.stop="moveDown" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STListItem } from "@stamhoofd/components";
import { RecordCategory, RecordSettings } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditRecordView from './EditRecordView.vue';

@Component({
    components: {
        STListItem
    },
})
export default class RecordRow extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    record: RecordSettings

    @Prop({ required: true })
    parentCategory: RecordCategory

    @Prop({ required: true })
    records: RecordSettings[]

    editRecord() {
        this.present(new ComponentWithProperties(EditRecordView, {
            record: this.record,
            parentCategory: this.parentCategory,
            isNew: false,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    addPatch(patch: PatchableArrayAutoEncoder<RecordSettings>) {
        this.$emit("patch", patch)
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
}
</script>