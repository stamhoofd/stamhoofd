<template>
    <TableView ref="table" :prefix-column="prefixColumn" default-sort-direction="DESC" :title="title" column-configuration-id="invoices" :actions="actions" :all-values="loading ? [] : invoices" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions" @refresh="refresh(false)" @click="editInvoice">
        <template #empty>
            Er zijn nog geen facturen.
        </template>
    </TableView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageButton, Column, TableAction, TableView, Toast } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Address, DateFilterDefinition,Filter, FilterDefinition, NumberFilterDefinition, STInvoiceMeta, STInvoicePrivate, StringFilterDefinition } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import EditInvoiceView from "./EditInvoiceView.vue";
import { InvoicesExcelExport } from "./InvoicesExcelExport";


@Component({
    components: {
        TableView
    }
})
export default class InvoicesView extends Mixins(NavigationMixin) {
    invoices: STInvoicePrivate[] = [];

    loading = false;
    actionLoading = false

    mounted() {
        UrlHelper.setUrl("/invoices")    
        document.title = "Facturen - Stamhoofd"
    }

    activated() {
        this.reload().catch(console.error);
    }

    get estimatedRows() {
        if (this.loading) {
            return 30
        }
       
        return 0
    }

    get actions(): TableAction<STInvoicePrivate>[] {
        return [
            new TableAction({
                name: "Nieuwe factuur",
                icon: "add",
                priority: 0,
                groupIndex: 1,
                needsSelection: false,
                handler: () => {
                    this.createInvoice()
                }
            }),
            new TableAction({
                name: "Bewerken",
                icon: "pencil",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: (invoices: STInvoicePrivate[]) => {
                    this.editInvoice(invoices[0])
                }
            }),
            new TableAction({
                name: "Download",
                icon: "download",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                handler: async (invoices: STInvoicePrivate[]) => {
                    // TODO
                    if (invoices.length === 1) {
                        this.showInvoice(invoices[0])
                    } else {
                        await this.downloadInvoices(invoices)
                    }
                }
            }),
        ]
    }

    allColumns = ((): Column<STInvoicePrivate, any>[] => {
        const cols: Column<STInvoicePrivate, any>[] = [
            new Column<STInvoicePrivate, number>({
                name: "#", 
                getValue: (invoice) => invoice.number ?? 0, 
                compare: (a, b) => Sorter.byNumberValue(b, a),
                minimumWidth: 70,
                recommendedWidth: 70,
                getStyleForObject: (invoice, isPrefix) => {
                    if (!isPrefix) {
                        return ""
                    }
                    return "primary"
                },
            }),

            new Column<STInvoicePrivate, string>({
                name: "Naam", 
                getValue: (invoice) => invoice.meta.companyName, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 400,
                grow: true,
            }),

            new Column<STInvoicePrivate, string | null>({
                name: "Referentie", 
                getValue: (invoice) => invoice.reference, 
                compare: (a, b) => Sorter.byStringValue(a ?? '', b ?? ''),
                getStyle: (value) => {
                    if (value === null) {
                        return "gray"
                    }
                    return ""
                },
                format: (value) => value ?? "Geen",
                minimumWidth: 100,
                recommendedWidth: 400,
                grow: false,
            }),

            new Column<STInvoicePrivate, Date | null>({
                name: "Datum", 
                getValue: (invoice) => invoice.meta.date ?? invoice.paidAt ?? invoice.createdAt, 
                format: (value) => value === null ? "Niet uitbetaald" : Formatter.date(value),
                getStyle: (value) => {
                    if (value === null) {
                        return "gray"
                    }
                    return ""
                },
                compare: (a, b) => Sorter.byDateValue(b ?? new Date(), a ?? new Date()),
                minimumWidth: 100,
                recommendedWidth: 100,
            }),

            new Column<STInvoicePrivate, string>({
                name: "Gemeente", 
                getValue: (invoice) => invoice.meta.companyAddress.city, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 100,
            }),

            new Column<STInvoicePrivate, number>({
                name: "Te betalen", 
                getValue: (invoice) => invoice.paidAt === null ? invoice.meta.priceWithVAT : 0, 
                format: (value) => value === 0 ? "" : Formatter.price(value),
                getStyle: (value) => {
                    if (value === 0) {
                        return "gray"
                    }
                    return ""
                },
                compare: (a, b) => Sorter.byNumberValue(b, a),
                minimumWidth: 50,
                recommendedWidth: 100,
                enabled: false
            }),

            new Column<STInvoicePrivate, number>({
                name: "Bedrag (excl)", 
                getValue: (invoice) => invoice.meta.priceWithoutVAT, 
                format: (value) => Formatter.price(value),
                compare: (a, b) => Sorter.byNumberValue(b, a),
                minimumWidth: 50,
                recommendedWidth: 100,
            }),

            new Column<STInvoicePrivate, Date | null>({
                name: "Uitbetalingsdatum", 
                getValue: (invoice) => invoice.settlement?.settledAt ?? null, 
                format: (value) => value === null ? "Niet uitbetaald" : Formatter.date(value),
                getStyle: (value) => {
                    if (value === null) {
                        return "gray"
                    }
                    return ""
                },
                compare: (a, b) => Sorter.byDateValue(b ?? new Date(), a ?? new Date()),
                minimumWidth: 50,
                recommendedWidth: 100,
            }),

            new Column<STInvoicePrivate, string | null>({
                enabled: false,
                name: "BTW-nummer", 
                getValue: (invoice) => invoice.meta.companyVATNumber, 
                compare: (a, b) => Sorter.byStringValue(a ?? '', b ?? ''),
                getStyle: (value) => {
                    if (value === null) {
                        return "gray"
                    }
                    return ""
                },
                format: (value) => value ?? "Geen",
                minimumWidth: 100,
                recommendedWidth: 400,
                grow: false,
            }),

            new Column<STInvoicePrivate, string | null>({
                enabled: false,
                name: "Ondernemingsnummer", 
                getValue: (invoice) => invoice.meta.companyNumber, 
                compare: (a, b) => Sorter.byStringValue(a ?? '', b ?? ''),
                getStyle: (value) => {
                    if (value === null) {
                        return "gray"
                    }
                    return ""
                },
                format: (value) => value ?? "Geen",
                minimumWidth: 100,
                recommendedWidth: 400,
                grow: false,
            }),


        ]

        
      
        return cols
    })()

    get prefixColumn() {
        // Needs to stay the same reference to enable disable/enable functionality
        return this.allColumns[0]
    }

    get filterDefinitions(): FilterDefinition<STInvoicePrivate, Filter<STInvoicePrivate>, any>[] {
        
        const invoiceNumber = new NumberFilterDefinition<STInvoicePrivate>({
            id: "invoice_number",
            name: "Factuurnummer",
            getValue: (invoice) => {
                return invoice.number ?? 0
            }
        })

        const definitions: FilterDefinition<STInvoicePrivate, Filter<STInvoicePrivate>, any>[] = [invoiceNumber]

      
        definitions.push(
            new DateFilterDefinition<STInvoicePrivate>({
                id: "invoice_date",
                name: "Datum",
                time: false,
                getValue: (invoice) => {
                    return invoice.meta.date ?? invoice.paidAt ?? invoice.createdAt ?? new Date(1900, 0, 1)
                }
            })
        )

        definitions.push(
            new StringFilterDefinition<STInvoicePrivate>({
                id: "company_name",
                name: "Bedrijfsnaam",
                getValue: (invoice) => {
                    return invoice.meta.companyName
                }
            })
        )

        definitions.push(
            new StringFilterDefinition<STInvoicePrivate>({
                id: "company_vat",
                name: "BTW-nummer",
                getValue: (invoice) => {
                    return invoice.meta.companyVATNumber ?? ''
                }
            })
        )

        definitions.push(
            new StringFilterDefinition<STInvoicePrivate>({
                id: "company_number",
                name: "Ondernemingsnummer",
                getValue: (invoice) => {
                    return invoice.meta.companyNumber ?? ''
                }
            })
        )

        return definitions
    }


    async reload() {
        if (this.loading) {
            return
        }
        this.loading = true;

        try {
            const response = await AdminSession.shared.authenticatedServer.request({
                method: "GET",
                path: "/invoices",
                decoder: new ArrayDecoder(STInvoicePrivate as Decoder<STInvoicePrivate>)
            })
            this.invoices = response.data
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }

        this.loading = false
    }

    async patchInvoices(patch: PatchableArrayAutoEncoder<STInvoicePrivate>) {
        const response = await AdminSession.shared.authenticatedServer.request({
            method: "PATCH",
            path: "/invoices",
            body: patch,
            decoder: new ArrayDecoder(STInvoicePrivate as Decoder<STInvoicePrivate>)
        })
        this.invoices = response.data
    }

    createInvoice() {
        const invoice = STInvoicePrivate.create({
            meta: STInvoiceMeta.create({
                companyName: "",
                companyContact: "",
                companyAddress: Address.createDefault(),
                companyVATNumber: null
            })
        })
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditInvoiceView, { 
                invoice,
                isNew: true,
                callback: async (patch: PatchableArrayAutoEncoder<STInvoicePrivate>) => {
                    await this.patchInvoices(patch)
                }
            })
        }).setDisplayStyle("popup"))
    }

    editInvoice(invoice: STInvoicePrivate) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditInvoiceView, { 
                invoice,
                isNew: false,
                callback: async (patch: PatchableArrayAutoEncoder<STInvoicePrivate>) => {
                    await this.patchInvoices(patch)
                }
            })
        }).setDisplayStyle("popup"))
    }

    get title() {
        return "Facturen"
    }

    showInvoice(invoice: STInvoicePrivate) {
        if (invoice.meta.pdf === undefined) {
            new CenteredMessage("Geen PDF gevonden", "Deze factuur heeft geen PDF", "error").addCloseButton().show()
            return
        }
        window.open(invoice.meta.pdf.getPublicPath(), "_blank")
    }

    async downloadInvoices(invoices: STInvoicePrivate[], onlyVAT?: boolean) {
        if (this.actionLoading) {
            return;
        }

        if (onlyVAT === undefined) {
            new CenteredMessage('Inclusief PDF voor feitelijke verenigingen?', 'Exporteer ook de PDF\'s voor feitelijke verenigingen? Alle facturen worden altijd in de Excel opgenomen.')
                .addButton(
                    new CenteredMessageButton('Zonder', {
                        action: async () => {
                            await this.downloadInvoices(invoices, true)
                        },
                        type: 'primary'
                    })
                )
                .addButton(
                    new CenteredMessageButton('Met', {
                        action: async () => {
                            await this.downloadInvoices(invoices, false)
                        },
                        type: 'secundary'
                    })
                ).show()
            return
        }
        this.actionLoading = true

        try {

            const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
            const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
            const zip = new JSZip();

            const groups = new Map<string, STInvoicePrivate[]>()

            // Group per month
            for (const invoice of invoices) {
                const date = invoice.meta.date ?? invoice.paidAt ?? invoice.createdAt

                if (!date) {
                    throw new Error("Missing createdAt date")
                }
                const year = date.getFullYear()
                const monthString = year+"-"+((date.getMonth() + 1)+"").padStart(2, "0")+" "+Formatter.capitalizeFirstLetter(Formatter.month(date.getMonth() + 1))

                const group = groups.get(monthString) ?? []
                group.push(invoice)
                groups.set(monthString, group)
            }

            for (const [month, group] of groups) {
                // Create an Excel file
                const folder = zip.folder(month)
                if (!folder) {
                    throw new Error("Failed to create folder")
                }

                // Sort group based on number here
                group.sort((a,b) => Sorter.byNumberValue(b.number ?? 0, a.number ?? 0))

                const excel = await InvoicesExcelExport.export(group)
                folder.file("0000-overzicht-"+month+".xlsx", excel)

                for (const invoice of group) {
                    if (!invoice.meta.pdf) {
                        throw new Error("PDF ontbreekt voor factuur "+(invoice.number ?? invoice.id));
                    }

                    if (onlyVAT) {
                        if (!invoice.meta.companyVATNumber) {
                            continue
                        }
                    }
                    const data = await fetch(invoice.meta.pdf!.getPublicPath())
                    const blob = await data.blob()
                    folder.file(
                        (invoice.number+"").padStart(4, "0")+" - "+Formatter.dateIso(invoice.meta.date!)+" - "+Formatter.fileSlug(invoice.meta.companyName)+".pdf", 
                        blob
                    );
                }
            }
            
            const blob = await zip.generateAsync({type:"blob"})
            saveAs(blob, "Facturen.zip");
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.actionLoading = false
        
    }
}
</script>