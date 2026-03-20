<template>
    <STListItem v-long-press="(e: any) => showContextMenu(e)" :selectable="true" class="right-stack" @click="editChoice()" @contextmenu.prevent="showContextMenu">
        <h3 class="style-title-list">
            {{ choice.name }}
        </h3>
        <p v-if="choice.description" class="style-description-small">
            {{ choice.description }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import STListItem from '#layout/STListItem.vue';
import type { RecordChoice, RecordSettings } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

import EditRecordChoiceView from '../EditRecordChoiceView.vue';

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

    async editChoice() {
        await this.present(new ComponentWithProperties(EditRecordChoiceView, {
            choice: this.choice,
            parentRecord: this.parentRecord,
            isNew: false,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordChoice>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    addPatch(patch: PatchableArrayAutoEncoder<RecordChoice>) {
        this.$emit("patch", patch)
    }

    moveUp() {
        const index = this.choices.findIndex(c => c.id === this.choice.id)
        if (index === -1 || index === 0) {
            return;
        }

        const moveTo = index - 2
        const p: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray()
        p.addMove(this.choice.id, this.choices[moveTo]?.id ?? null)
        this.addPatch(p)
    }
     
    moveDown() {
        const index = this.choices.findIndex(c => c.id === this.choice.id)
        if (index === -1 || index >= this.choices.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray()
        p.addMove(this.choice.id, this.choices[moveTo]?.id ?? null)
        this.addPatch(p)
    }

    showContextMenu(event: TouchEvent | MouseEvent) {
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: $t(`%11f`),
                    icon: "arrow-up",
                    action: () => {
                        this.moveUp()
                        return true;
                    }
                }),
                new ContextMenuItem({
                    name: $t(`%11g`),
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
