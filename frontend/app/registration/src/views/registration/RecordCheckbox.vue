<template>
    <div>
        <Checkbox v-model="enabled">
            {{ checkboxText }}
            <p class="style-description-small" v-if="hint">{{ hint }}</p>
        </Checkbox>
        <div v-if="enabled && (comments || placeholder)" class="textarea-container">
            <textarea v-model="description" class="input" :placeholder="descriptionPlaceholder" />
            <p class="info-box" v-if="comment">{{ comment }}</p>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox } from "@stamhoofd/components"
import { Record, RecordType, RecordTypeHelper } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    "components": {
        Checkbox,
    },
    model: {
        prop: 'records',
        event: 'change'
    },
})
export default class RecordCheckbox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    type!: RecordType

    @Prop({ required: false, default: null })
    name!: string | null

    @Prop({ required: false, default: null })
    comment!: string | null

    @Prop({ default: false })
    comments!: boolean

    /**
     * Not checked = included in records
     */
    @Prop({ default: false })
    invert!: boolean

    @Prop({ required: false, default: null })
    placeholder!: string | null

    @Prop({ required: true })
    records!: Record[]

    get checkboxText() {
        if (!this.name) {
            return RecordTypeHelper.getName(this.type)
        }
        return this.name
    }

    get descriptionPlaceholder() {
        if (!this.placeholder) {
            return "Opmerkingen (optioneel)"
        }
        return this.placeholder
    }

    get hint() {
        return RecordTypeHelper.getHint(this.type) 
    }

    get enabled() {
        return !!this.records.find(r => r.type == this.type)
    }

    set enabled(enabled: boolean) {
        const index = this.records.findIndex(r => r.type == this.type)
        if ((index != -1) === enabled) {
            return
        }
        if (enabled) {
            this.records.push(Record.create({
                type: this.type,
            }))
        } else {
            this.records.splice(index, 1)
        }
    }

    get description() {
        const record = this.records.find(r => r.type == this.type)
        if (!record) {
            return ""
        }
        return record.description
    }

    set description(description: string) {
        const record = this.records.find(r => r.type == this.type)
        if (!record) {
            console.error("Tried to set description for record that doesn't exist")
            return
        }
        record.description = description
    }
}
</script>