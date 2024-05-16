<template>
    <form class="st-view filter-editor" @submit.prevent="save">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>
            <!-- Todo: hier selector: nieuwe filter maken of bestaande filter bewerken, of opslaan als niewue filter -->

            <PropertyFilterInput v-model="editingConfiguration" :builder="builder" />
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="cancel">
                    Annuleren
                </button>
                <button class="button primary" type="button" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { PropertyFilter, Version } from "@stamhoofd/structures";

import STNavigationBar from "../../navigation/STNavigationBar.vue";
import STToolbar from "../../navigation/STToolbar.vue";
import { CenteredMessage } from "../../overlays/CenteredMessage";
import { UIFilterBuilder } from "../UIFilter";
import PropertyFilterInput from "./PropertyFilterInput.vue";

@Component({
    components: {
        STNavigationBar,
        PropertyFilterInput,
        STToolbar
    },
})
export default class PropertyFilterView extends Mixins(NavigationMixin) {
    @Prop({ default: "" })
        title!: string

    @Prop({ required: true })
        builder!: UIFilterBuilder

    @Prop({ required: true })
        configuration!: PropertyFilter

    @Prop({ required: true })
        setConfiguration!: (configuration: PropertyFilter) => void

    editingConfiguration: PropertyFilter = this.configuration

    cancel() {
        this.dismiss({ force: true })
    }

    save() {
        this.setConfiguration(this.editingConfiguration)
        this.dismiss({ force: true })
    }

    isChanged() {
        return JSON.stringify(this.editingConfiguration.encode({ version: Version })) != JSON.stringify(this.configuration.encode({ version: Version }))
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>
