<template>
    <form class="st-view filter-editor" @submit.prevent="applyFilter">
        <STNavigationBar :title="title">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="canDismiss" class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>
            <!-- Todo: hier selector: nieuwe filter maken of bestaande filter bewerken, of opslaan als niewue filter -->

            <PropertyFilterConfigurationInput :configuration="editingConfiguration" :definitions="definitions" @patch="addPatch"/>
        </main>

        <STToolbar>
            <button slot="right" class="button secundary" type="button" @click="cancel">
                Annuleren
            </button>
            <button slot="right" class="button primary" type="button" @click="save">
                Opslaan
            </button>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, STNavigationBar } from "@stamhoofd/components";
import { BackButton, PropertyFilterConfigurationInput, STToolbar } from "@stamhoofd/components";
import { Filter, FilterDefinition, PropertyFilterConfiguration, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
        STNavigationBar,
        BackButton,
        PropertyFilterConfigurationInput,
        STToolbar
    },
})
export default class PropertyFilterConfigurationView extends Mixins(NavigationMixin) {
    @Prop({ default: "" })
    title!: string

    @Prop({ required: true })
    configuration!: PropertyFilterConfiguration

    @Prop({ required: true })
    definitions!: FilterDefinition<any, Filter<any>, any>[]

    @Prop({ required: true })
    setConfiguration: (configuration: PropertyFilterConfiguration) => void

    editingConfiguration: PropertyFilterConfiguration = this.configuration.clone()

    cancel() {
        this.dismiss({ force: true })
    }

    addPatch(patch: AutoEncoderPatchType<PropertyFilterConfiguration>) {
        this.editingConfiguration = this.editingConfiguration.patch(patch)
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