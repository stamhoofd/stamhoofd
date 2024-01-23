<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-description right-stack" @click="editOption()" @contextmenu.prevent="showContextMenu">
        <Radio v-if="!optionMenu.multipleChoice" slot="left" v-model="isFirst" :value="true" :disabled="true" />
        <Checkbox v-else slot="left" :disabled="true" />

        <h3 class="style-title-list">
            {{ option.name || 'Naamloos' }}
        </h3>

        <template slot="right">
            <span>{{ option.price | priceChange }}</span>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ContextMenu, ContextMenuItem, LongPressDirective, Radio,STListItem } from "@stamhoofd/components";
import { Option, OptionMenu } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditOptionView from './EditOptionView.vue';

@Component({
    components: {
        STListItem,
        Checkbox,
        Radio
    },
    filters: {
        priceChange: Formatter.priceChange.bind(Formatter)
    },
    directives: {
        LongPress: LongPressDirective
    }
})
export default class OptionRow extends Mixins(NavigationMixin) {
    @Prop({})
        optionMenu: OptionMenu

    @Prop({})
        option: Option

    get isFirst() {
        return this.optionMenu.options[0].id === this.option.id
    }

    set isFirst(set: boolean) {
        // udno
    }

    addOptionPatch(patch: AutoEncoderPatchType<Option>) {
        const p = OptionMenu.patch({ id: this.optionMenu.id })
        p.options.addPatch(Option.patch(Object.assign({}, patch, { id: this.option.id })))
        this.$emit("patch", p)
    }

    editOption() {
        this.present(new ComponentWithProperties(EditOptionView, { option: this.option, optionMenu: this.optionMenu, isNew: false,  saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
            this.$emit("patch", patch)

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }

    moveUp() {
        this.$emit("move-up")
    }

    moveDown() {
        this.$emit("move-down")
    }

    async delete() {
        if (!(await CenteredMessage.confirm('Deze keuze verwijderen?', 'Verwijderen'))) {
            return
        }
        const p = OptionMenu.patch({ id: this.optionMenu.id })
        p.options.addDelete(this.option.id)
        this.$emit("patch", p)
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
            ],
            [
                new ContextMenuItem({
                    name: "Verwijderen",
                    icon: "trash",
                    disabled: this.optionMenu.options.length <= 1,
                    action: () => {
                        this.delete().catch(console.error)
                        return true;
                    }
                }),
            ]
        ])
        menu.show({ clickEvent: event }).catch(console.error)
    }
}
</script>
