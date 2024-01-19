<template>
    <SaveView :title="title" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>
        <p v-if="description">
            {{ description }}
        </p>
          
        <STErrorsDefault :error-box="errorBox" />

        <input
            ref="firstInput"
            v-model="value"
            class="input"
            type="text"
            :placeholder="placeholder"
            autocomplete=""
        >
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, SaveView, STErrorsDefault } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        SaveView,
        STErrorsDefault
    },
})
export default class InputSheet extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null

    saving = false

    @Prop({ required: true })
        title: string

    @Prop({ default: '' })
        description: string

    @Prop({ default: '' })
        placeholder: string

    @Prop({ default: '' })
        defaultValue!: string
    
    @Prop({ required: true })
        saveHandler: (value: string) => Promise<void>|void;

    value = this.defaultValue

    async save() {
        if (this.saving) {
            return;
        }
        this.saving = true;
        try {
            await this.saveHandler(this.value)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false;
    }

    get hasChanges() {
        return this.value != this.defaultValue
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>