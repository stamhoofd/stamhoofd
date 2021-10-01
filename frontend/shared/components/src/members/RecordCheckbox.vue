<template>
    <div class="record-checkbox">
        <Checkbox v-model="enabled">
            {{ checkboxText }}
            <p v-if="hint" class="style-description-small">
                {{ hint }}
            </p>
        </Checkbox>
        <div v-if="enabled && (comments || placeholder)" class="textarea-container">
            <input v-if="small" v-model="description" class="input" :placeholder="descriptionPlaceholder">
            <textarea v-else v-model="description" class="input" :placeholder="descriptionPlaceholder" />
            <p v-if="comment" class="info-box">
                {{ comment }}
            </p>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { LegacyRecord, LegacyRecordType, LegacyRecordTypeHelper } from "@stamhoofd/structures"
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
    type!: LegacyRecordType

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

    @Prop({ default: false })
    small!: boolean

    @Prop({ required: true })
    records!: LegacyRecord[]

    get checkboxText() {
        if (!this.name) {
            return LegacyRecordTypeHelper.getName(this.type)
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
        return LegacyRecordTypeHelper.getHint(this.type) 
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
            this.records.push(LegacyRecord.create({
                type: this.type,
                author: SessionManager.currentSession?.user?.id
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
        record.author = SessionManager.currentSession?.user?.id
    }
}
</script>