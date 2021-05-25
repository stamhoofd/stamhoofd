<template>
    <div>
        <STList>
            <WebshopFieldRow v-for="field in fields" :key="field.id" :field="field" @patch="addPatch" @move-up="moveFieldUp(field)" @move-down="moveFieldDown(field)" />
        </STList>
        <p>
            <button class="button text" @click="addField">
                <span class="icon add" />
                <span>Vraag toevoegen</span>
            </button>
        </p>
    </div>
</template>

<script lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STList, STListItem } from "@stamhoofd/components";
import { WebshopField } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditWebshopFieldView from './EditWebshopFieldView.vue';
import WebshopFieldRow from "./WebshopFieldRow.vue"

@Component({
    components: {
        STListItem,
        STList,
        WebshopFieldRow
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
})
export default class WebshopFieldsBox extends Mixins(NavigationMixin) {
    @Prop({})
    fields: WebshopField[]

    moveFieldUp(field: WebshopField) {
        const index = this.fields.findIndex(c => field.id === c.id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p: PatchableArrayAutoEncoder<WebshopField>= new PatchableArray()
        p.addMove(field.id, this.fields[moveTo]?.id ?? null)
        this.addPatch(p)
    }

    moveFieldDown(field: WebshopField) {
        const index = this.fields.findIndex(c => field.id === c.id)
        if (index == -1 || index >= this.fields.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p: PatchableArrayAutoEncoder<WebshopField>= new PatchableArray()
        p.addMove(field.id, this.fields[moveTo].id)
        this.addPatch(p)
    }
    
    addField() {
        const field = WebshopField.create({})

        const p: PatchableArrayAutoEncoder<WebshopField>= new PatchableArray()
        p.addPut(field)

        this.present(new ComponentWithProperties(EditWebshopFieldView, { field, isNew: true, saveHandler: (patch: PatchableArrayAutoEncoder<WebshopField>) => {
            this.$emit("patch", p.patch(patch))
        }}).setDisplayStyle("sheet"))
    }

    addPatch(patch: PatchableArrayAutoEncoder<WebshopField>) {
        this.$emit("patch", patch)
    }
}
</script>