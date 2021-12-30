<template>
    <form class="st-view filter-editor" @submit.prevent="applyFilter">
        <STNavigationBar :title="title">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="canDismiss" type="button" class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>
            <!-- Todo: hier selector: nieuwe filter maken of bestaande filter bewerken, of opslaan als niewue filter -->

            <PropertyFilterInput v-model="editingConfiguration" :organization="organization" />
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, STNavigationBar } from "@stamhoofd/components";
import { BackButton, PropertyFilterInput, STToolbar } from "@stamhoofd/components";
import { Organization, PropertyFilter, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
        STNavigationBar,
        BackButton,
        PropertyFilterInput,
        STToolbar
    },
})
export default class PropertyFilterView extends Mixins(NavigationMixin) {
    @Prop({ default: "" })
    title!: string

    @Prop({ required: true })
    organization: Organization

    @Prop({ required: true })
    configuration!: PropertyFilter<any>

    @Prop({ required: true })
    setConfiguration: (configuration: PropertyFilter<any>) => void

    editingConfiguration: PropertyFilter<any> = this.configuration

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