<template>
    <LoadingView v-if="loading" />
    <div v-else id="documents-view" class="st-view background">
        <STNavigationBar title="Documenten" />

        <main class="center">
            <h1 class="style-navigation-title">
                Documenten
            </h1>

            <p v-if="disableActivities" class="error-box">
                Deze functie is niet beschikbaar omdat jouw vereniging nog het oude gratis ledenadministratie pakket gebruikt. Via instellingen kunnen hoofdbeheerders overschakelen op de betaalde versie met meer functionaliteiten.
            </p>

            <p class="style-description">
                Maak documenten aan en deel ze met jouw leden. Daarbij is het mogelijk om gegevens van leden automatisch in te vullen in de documenten, bijvoorbeeld voor een fiscaal attest of een deelnamebewijs voor de mutualiteit.
            </p>

            <STList>
                <STListItem v-for="template of templates" :key="template.id" :selectable="true" class="right-stack" @click="openTemplate(template)">
                    <h2 class="style-title-list">
                        {{ template.settings.name }}
                    </h2>
                    <p class="style-description-small">
                        Aangemaakt op {{ formatDate(template.createdAt) }}
                    </p>

                    <template #right><span v-if="template.status === 'Draft'" class="style-tag">Klad</span>
                    <span class="icon arrow-right-small gray" /></template>
                </STListItem>
            </STList>

            <p class="style-button-bar">
                <button type="button" class="button text" @click="addDocument">
                    <span class="icon add" />
                    <span class="text">Nieuw document</span>
                </button>
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LoadingView,STList, STListItem, STNavigationBar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { DocumentTemplatePrivate } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import DocumentTemplateOverview from "./DocumentTemplateOverview.vue";
import EditDocumentTemplateView from "./EditDocumentTemplateView.vue";

@Component({
    components: {
        STNavigationBar,
        STList,
        STListItem,
        LoadingView
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class DocumentTemplatesView extends Mixins(NavigationMixin) {
    templates: DocumentTemplatePrivate[] = []
    loading = true

    mounted() {
        // First set current url already, to fix back
        UrlHelper.setUrl("/documents")
        document.title = "Stamhoofd - Documenten"
        this.loadTemplates().catch(console.error)
    }

    get organization() {
        return this.$organization
    }

    activated() {
        this.loadTemplates().catch(console.error)
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    formatDate(date: Date) {
        return Formatter.date(date)
    }

    async loadTemplates() {
        try {
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/organization/document-templates",
                decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
                shouldRetry: false,
                owner: this
            })
            this.templates = response.data
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }
        this.loading = false
    }

    get disableActivities() {
        return this.organization.meta.packages.disableActivities
    }

    addDocument() {
        if (this.organization.meta.packages.disableActivities) {
            new Toast("Je kan geen documenten aanmaken in de gratis versie van Stamhoofd", 'error red').show()
            return
        }

        this.present({
            components: [
                new ComponentWithProperties(EditDocumentTemplateView, {
                    isNew: true,
                    document: DocumentTemplatePrivate.create({}),
                    callback: (template: DocumentTemplatePrivate) => {
                        this.templates.push(template)
                        this.openTemplate(template)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    openTemplate(template: DocumentTemplatePrivate) {
        this.show({
            components: [
                new ComponentWithProperties(DocumentTemplateOverview, {
                    template
                })
            ]
        })
    }
}
</script>