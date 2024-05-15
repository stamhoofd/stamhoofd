<template>
    <TableView ref="table" :organization="organization" :title="title" :default-sort-column="defaultSortColumn" :column-configuration-id="'documents-' + template.id" :actions="actions" :all-values="loading ? [] : allValues" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions" @refresh="reload(false)" @click="openDocument">
        <template #empty>
            Er zijn nog geen documenten aangemaakt. Controleer of er wel leden zijn die aan de voorwaarden voor dit document voldoen.
        </template>
    </TableView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Column, TableAction, TableView, Toast } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { RecordWarning, RecordWarningType } from "@stamhoofd/structures";
import { Document, DocumentStatus, DocumentStatusHelper, DocumentTemplatePrivate, RecordCategory } from "@stamhoofd/structures";
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import { DocumentActionBuilder } from "./DocumentActionBuilder";
import DocumentView from "./DocumentView.vue";

@Component({
    components: {
        TableView
    }
})
export default class DocumentsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        template!: DocumentTemplatePrivate;
   
    loading = true
    allValues: Document[] = []

    get organization() {
        return this.$organization
    }

    mounted() {
        // Set url
        this.updateUrl()
        UrlHelper.shared.clear()

        this.reload().catch(console.error);
    }

    updateUrl() {
        UrlHelper.setUrl("/documents/"+Formatter.slug(this.template.id))
        document.title = this.template.privateSettings.templateDefinition.name + " - Documenten"
    }

    get estimatedRows() {
        if (!this.loading) {
            return 0
        }

        return 30
    }
    
    get actions(): TableAction<Document>[] {
        const builder = new DocumentActionBuilder({
            $context: this.$context,
            template: this.template,
            component: this,
            addDocument: (document: Document) => {
                this.allValues.push(document)
            }
        })
        return [
            ...builder.getActions(),
            new TableAction({
                name: "Openen",
                icon: "eye",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: (documents: Document[]) => {
                    this.openDocument(documents[0])
                }
            })

        ]
    }

    getColumns(): Column<Document, any>[] {
        const cols: Column<Document, any>[] = [
            new Column<Document, string>({
                enabled: false,
                name: "Volgnummer", 
                getValue: (v) => v.id, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 370,
                grow: false,
            }),

            new Column<Document, number | null>({
                name: "Nummer", 
                getValue: (v) => v.number, 
                compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
                format: (n) => n ? n.toString() : "Niet toegekend",
                getStyle: (status) => {
                    if (status === null) {
                        return 'gray'
                    }
                    return '';
                },
                minimumWidth: 100,
                recommendedWidth: 200,
                grow: false,
                enabled: false
            }),

            new Column<Document, string>({
                name: "Beschrijving", 
                getValue: (v) => v.data.description, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 320,
                grow: true,
            }),

            new Column<Document, DocumentStatus>({
                name: "Status", 
                getValue: (document) => document.status,
                format: (status) => DocumentStatusHelper.getName(status),
                compare: (a, b) => Sorter.byEnumValue(a, b, DocumentStatus), 
                getStyle: (status) => {
                    return DocumentStatusHelper.getColor(status)
                },
                minimumWidth: 100,
                recommendedWidth: 120,
            }),

            new Column<Document, RecordWarning[]>({
                name: "Waarschuwingen", 
                getValue: (document) => {
                    return document.data.fieldAnswers.reduce((c, answer) => [...c, ...answer.getWarnings()], [])
                },
                format: (warnings) => {
                    if (warnings.length === 1) {
                        return 'Waarschuwing'
                    }
                    if (warnings.length > 1) {
                        return `${warnings.length} waarschuwingen`
                    }
                    return 'Geen'
                },
                compare: (a, b) => -Sorter.byNumberValue(a.length, b.length), 
                getStyle: (warnings) => {
                    if (warnings.length > 0) {
                        if (warnings.find(w => w.type === RecordWarningType.Error)) {
                            return 'error'
                        }
                        return 'warn'
                    }
                    return 'gray'
                },
                minimumWidth: 100,
                recommendedWidth: 150,
            }),
        ]

        return cols
    }

    allColumns = this.getColumns()

    get defaultSortColumn() {
        return this.allColumns[1]
    }


    get title() {
        return "Documenten"
    }

    openDocument(document: Document) {
        const table = this.$refs.table as TableView<Document> | undefined
        const component = new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(DocumentView, { 
                document,
                template: this.template,
                getNext: table?.getNext,
                getPrevious: table?.getPrevious,
            })
        })

        if ((this as any).$isMobile) {
            this.show(component)
        } else {
            component.modalDisplayStyle = "popup";
            this.present(component);
        }
    }

    get filterDefinitions() {
        return []
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    async reload(visibleReload = true) {
        Request.cancelAll(this)
        this.loading = visibleReload;

        try {
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/organization/document-templates/" + encodeURIComponent(this.template.id) + "/documents",
                decoder: new ArrayDecoder(Document as Decoder<Document>),
                shouldRetry: false,
                owner: this
            })
            this.allValues = response.data
        } catch (e) {
            if (!Request.isNetworkError(e) || visibleReload) {
                Toast.fromError(e).show()
            }
        }
        if (visibleReload) {
            this.loading = false
        }
    }
}
</script>
