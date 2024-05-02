<template>
    <div class="st-view pending-invoices-view background">
        <STNavigationBar :sticky="false">
            <template #left>
                <template #left>
                    <BackButton v-if="canPop" @click="pop" />
                </template>
                <STNavigationTitle v-else>
                    {{ title }}
                </STNavigationTitle>
            </template>
            <template #right>
                <div class="input-icon-container icon search gray">
                    <input v-model="searchQuery" class="input" placeholder="Zoeken" @input="searchQuery = $event.target.value">
                </div>
            </template>
        </STNavigationBar>
    
        <main>
            <h1 v-if="canPop">
                {{ title }}
            </h1>

            <Spinner v-if="loading && sortedInvoices.length == 0" class="center" />
            <table v-else class="data-table">
                <thead>
                    <tr>
                        <th class="prefix">
                            <Checkbox
                                v-model="selectAll"
                            />
                        </th>
                        
                        <th class="hide-smartphone" @click="toggleSort('organization')">
                            Vereniging
                            <span
                                class="sort-arrow icon"
                                :class="{
                                    'arrow-up-small': sortBy == 'organization' && sortDirection == 'ASC',
                                    'arrow-down-small': sortBy == 'organization' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th @click="toggleSort('price')">
                            Bedrag
                            <span
                                class="sort-arrow icon"
                                :class="{
                                    'arrow-up-small': sortBy == 'price' && sortDirection == 'ASC',
                                    'arrow-down-small': sortBy == 'price' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="invoice in sortedInvoices" :key="invoice.id" class="selectable" @click="showInvoice(invoice.invoice)" @contextmenu.prevent="showInvoiceContextMenu($event, invoice.invoice)">
                        <td class="prefix" @click.stop="">
                            <Checkbox v-model="invoice.selected" @change="onChanged(invoice)" />
                        </td>
                        <td>
                            <h2 class="style-title-list">
                                {{ invoice.invoice.organization ? invoice.invoice.organization.name : invoice.invoice.meta.companyName }}
                            </h2>
                            <p v-if="invoice.invoice.organization" class="style-description">
                                {{ invoice.invoice.organization.address }}
                            </p>
                            <p v-else class="style-description">
                                {{ invoice.invoice.meta.companyAddress }}
                            </p>

                            <p v-if="!invoice.invoice.organization" class="style-tag error inline">
                                Verwijderde vereniging
                            </p>

                            <p v-if="invoice.invoice.invoice" class="style-tag warn inline">
                                In verwerking
                            </p>

                            <p v-if="paymentFailedCount(invoice) > 0" class="style-tag error inline">
                                Betaling {{ paymentFailedCount(invoice) }} keer mislukt
                            </p>
                        </td>
                        <td class=" hide-smartphone">
                            {{ formatPrice(invoice.invoice.meta.priceWithVAT ) }} incl. BTW
                        </td>
                        
                        <td>
                            <button class="button icon gray more" @click.stop="showInvoiceContextMenu($event, invoice.invoice)" />
                        </td>
                    </tr>
                </tbody>
            </table>

            <template v-if="!loading && invoices.length == 0">
                <p class="info-box">
                    Er zijn nog geen openstaande bedragen.
                </p>
            </template>
        </main>

        <STToolbar>
            <template #left>
                {{ selectionCount ? selectionCount : "Geen" }} {{ selectionCount == 1 ? "factuur" : "facturen" }} geselecteerd
                <template v-if="selectionCountHidden">
                    (waarvan {{ selectionCountHidden }} verborgen)
                </template>
            </template>
            <template #right>
                <LoadingButton :loading="actionLoading">
                    <button class="button primary" :disabled="selectionCount == 0" @click="openMail()">
                        <span class="dropdown-text">Downloaden</span>
                        <div class="dropdown" @click.stop="openMailDropdown">
                            <span class="icon arrow-down-small" />
                        </div>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { SegmentedControl, Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, LoadingButton,Spinner, STNavigationTitle } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { STToolbar } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { MemberWithRegistrations, STInvoicePrivate, STPendingInvoicePrivate } from '@stamhoofd/structures';
import { Formatter, Sorter, StringCompare } from '@stamhoofd/utility';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import InvoiceView from "../invoices/InvoiceView.vue";

class SelectableInvoice {
    invoice: STPendingInvoicePrivate;
    selected = true;

    constructor(invoice: STPendingInvoicePrivate, selected = true) {
        this.invoice = invoice;
        this.selected = selected
    }
}

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STNavigationTitle,
        STToolbar,
        BackButton,
        Spinner,
        LoadingButton,
        SegmentedControl
    },
    directives: { Tooltip },
})
export default class PendingInvoicesView extends Mixins(NavigationMixin) {
    invoices: SelectableInvoice[] = [];
    searchQuery = "";
    filters = [];
    selectedFilter = 0;
    selectionCountHidden = 0;
    sortBy = "price";
    sortDirection = "DESC";

    loading = false;
    actionLoading = false

    mounted() {
        UrlHelper.setUrl("/pending-invoices")    
        document.title = "Openstaande bedragen - Stamhoofd"
    }

    activated() {
        this.reload().catch(console.error);
    }

    async reload() {
        if (this.loading) {
            return
        }
        this.loading = true;

        try {
            const response = await AdminSession.shared.authenticatedServer.request({
                method: "GET",
                path: "/pending-invoices",
                decoder: new ArrayDecoder(STPendingInvoicePrivate as Decoder<STPendingInvoicePrivate>)
            })
            this.invoices = response.data.map(s => new SelectableInvoice(s, false))
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }

        this.loading = false
    }


    get title() {
        return "Openstaande bedragen"
    }

    formatDate(date: Date) {
        return Formatter.date(date, true)
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    paymentFailedCount(invoice: SelectableInvoice) {
        let d = 0
        for (const item of invoice.invoice.meta.items) {
            if (!item.package || item.package.meta.paymentFailedCount === 0) {
                continue
            }
            d = Math.max(d, item.package.meta.paymentFailedCount)
        }
        return d
    }

    get sortedInvoices(): SelectableInvoice[] {
        if (this.sortBy == "organization") {
            return this.filteredInvoices.slice().sort((a, b) => (this.sortDirection === "DESC" ? -1 : 1) * Sorter.byStringValue(a.invoice.organization?.name ?? "", b.invoice.organization?.name ?? ""))
        }

        if (this.sortBy == "price") {
            return this.filteredInvoices.slice().sort((a, b) => (this.sortDirection === "DESC" ? 1 : -1) * Sorter.byNumberValue(a.invoice.meta.priceWithoutVAT, b.invoice.meta.priceWithoutVAT))
        }
        
        return this.filteredInvoices;
    }

    isDescriptiveFilter() {
        return !!((this.filters[this.selectedFilter] as any).getDescription)
    }

    get filteredInvoices(): SelectableInvoice[] {
        this.selectionCountHidden = 0;
        const filtered = this.invoices.slice()
        /*const filtered = this.invoices.filter((invoice: SelectableInvoice) => {
            if (this.filters[this.selectedFilter].doesMatch(invoice.invoice, this.$organization)) {
                return true;
            }
            this.selectionCountHidden += invoice.selected ? 1 : 0;
            return false;
        });*/

        if (this.searchQuery == "") {
            return filtered;
        }
        return filtered.filter((invoice: SelectableInvoice) => {
            if (
                StringCompare.contains(invoice.invoice.organization?.name ?? "", this.searchQuery)
            ) {
                return true;
            }
            this.selectionCountHidden += invoice.selected ? 1 : 0;
            return false;
        }).sort((a, b) => Sorter.byNumberValue(StringCompare.searchScore(a.invoice.organization?.name ?? "", this.searchQuery, null, null), StringCompare.searchScore(b.invoice.organization?.name ?? "", this.searchQuery, null, null)));
    }

    get selectionCount(): number {
        let val = 0;
        this.invoices.forEach((invoice) => {
            if (invoice.selected) {
                val++;
            }
        });
        return val;
    }

    get visibleSelectionCount(): number {
        let val = 0;
        this.filteredInvoices.forEach((inv) => {
            if (inv.selected) {
                val++;
            }
        });
        return val;
    }

    toggleSort(field: string) {
        if (this.sortBy == field) {
            if (this.sortDirection == "ASC") {
                this.sortDirection = "DESC";
            } else {
                this.sortDirection = "ASC";
            }
            return;
        }
        this.sortBy = field;
    }

    onChanged(_selectableMember: SelectableInvoice) {
        // do nothing for now
    }

    get selectAll() {
        return this.visibleSelectionCount >= this.filteredInvoices.length && this.filteredInvoices.length > 0
    }

    set selectAll(selected: boolean) {
        this.filteredInvoices.forEach((invoice) => {
            invoice.selected = selected;
        });
    }

    showInvoice(invoice: STPendingInvoicePrivate) {
        this.present(new ComponentWithProperties(InvoiceView, {
            invoice
        }).setDisplayStyle("popup"))
    }

    showInvoiceContextMenu(event, invoice: STPendingInvoicePrivate) {
    }

    getSelectedInvoices(): STPendingInvoicePrivate[] {
        return this.invoices
            .filter((invoice: SelectableInvoice) => {
                return invoice.selected;
            })
            .map((invoice: SelectableInvoice) => {
                return invoice.invoice;
            });
    }

    openMail(subject = "") {
        /*const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                invoices: this.getSelectedInvoices(),
                group: this.group,
                defaultSubject: subject
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));*/
    }

    openMailDropdown(event) {
        /*if (this.selectionCount == 0) {
            return;
        }
        const displayedComponent = new ComponentWithProperties(GroupListSelectionContextMenu, {
            x: event.clientX,
            y: event.clientY + 10,
            invoices: this.getSelectedInvoices(),
            group: this.group,
            cycleOffset: this.cycleOffset,
            waitingList: this.waitingList
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));*/
    }
}
</script>