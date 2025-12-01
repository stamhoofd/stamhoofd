<template>
    <div class="st-view background">
        <STNavigationBar title="Facturen en betalingen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Facturen en betaalinstellingen
            </h1>

            <p>
                Alle bedragen zijn excl. BTW, tenzij anders vermeld.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <Spinner v-if="loadingStatus" />
            <template v-else>
                <div class="split-inputs">
                    <div>
                        <STInputBox title="Openstaand bedrag">
                            <p class="button style-price-big" @click="openPendingInvoice">
                                <span>
                                    {{ status.pendingInvoice ? status.pendingInvoice.meta.priceWithoutVAT : 0 | price }}
                                </span>
                                <span v-if="status.pendingInvoice && status.pendingInvoice.meta.priceWithoutVAT > 0" class="icon arrow-right" />
                            </p>
                        </STInputBox>
                        <p class="style-description-small">
                            Dit bedrag zal bij jouw volgende afrekening aangerekend worden.
                        </p>
                    </div>

                    <div>
                        <STInputBox title="Jouw tegoed">
                            <p class="button style-price-big" @click="showCreditsHistory">
                                <span>{{ balance | price }}</span>
                                <span v-if="status.credits.length > 0" class="icon arrow-right" />
                            </p>
                        </STInputBox>
                        <p class="style-description-small">
                            Jouw tegoed wordt automatisch in mindering gebracht op je volgende factuur.
                        </p>
                    </div>
                </div>

                <hr>
                <h2>Standaard betaalmethode</h2>
                <p>Koppel een bankkaart of creditcard waarmee automatische betalingen kunnen gebeuren. Deze rekening wordt gebruikt voor automatische incasso's.</p>

                <MandateSelectionList
                    :organization="organization"
                    :default-status="status"
                    :allow-selection="false"
                />

                <p>
                    <button type="button" class="button text" @click="linkNewMandate">
                        <span class="icon add" />  
                        <span>Nieuwe betaalkaart koppelen</span>
                    </button>
                </p>
                <p v-if="status && status.mandates.length > 0">
                    <button type="button" class="button text" @click="updateDefaultMandate">
                        <span class="icon sync" />  
                        <span>Wijzig standaard betaalmethode</span>
                    </button>
                </p>

                <template v-if="companyName">
                    <hr>
                    <h2>Facturatiegegevens</h2>
                    <p v-if="hasFullAccess">
                        Deze gegevens worden gebruikt voor toekomstige automatische facturen. <button type="button" class="inline-link" @click="openGeneralSettings">
                            Wijzigen
                        </button> 
                    </p>
                    <p v-else>
                        Deze gegevens worden gebruikt voor toekomstige automatische facturen. Vraag een hoofdbeheerder van je vereniging om deze gegevens te wijzigen indien nodig.
                    </p>

                    <STList class="info">
                        <STListItem>
                            <h3 v-if="companyNumber || VATNumber" class="style-definition-label">
                                Bedrijfsnaam
                            </h3>
                            <h3 v-else class="style-definition-label">
                                Vereniging
                            </h3>
                            <p class="style-definition-text">
                                {{ companyName }}
                            </p>
                        </STListItem>
                        <STListItem v-if="companyAddress">
                            <h3 class="style-definition-label">
                                Adres
                            </h3>
                            <p class="style-definition-text">
                                {{ companyAddress.toString() | capitalizeFirstLetter }}
                            </p>
                        </STListItem>
                        <STListItem v-if="VATNumber">
                            <h3 class="style-definition-label">
                                BTW-nummer
                            </h3>
                            <p class="style-definition-text">
                                {{ VATNumber }}
                            </p>
                        </STListItem>
                        <STListItem v-else-if="companyNumber">
                            <h3 class="style-definition-label">
                                {{ $t('shared.inputs.companyNumber.label') }}
                            </h3>
                            <p class="style-definition-text">
                                {{ companyNumber }}
                            </p>
                        </STListItem>
                        <STListItem v-else>
                            <h3 class="style-definition-label">
                                {{ $t('shared.inputs.companyNumber.label') }}
                            </h3>
                            <p class="style-definition-text">
                                {{ $t('dashboard.settings.billing.unincorporatedAssociationDescription') }}
                            </p>
                        </STListItem>
                    </STList>
                </template>

                <hr>
                <h2>Facturen</h2>

                <STList v-if="status && status.invoices.length > 0">
                    <STListItem v-for="invoice of status.invoices" :key="invoice.id" :selectable="true" class="right-stack" @click="downloadInvoice(invoice)">
                        <h3 class="style-title-list">
                            {{ invoice.meta.priceWithoutVAT < 0 ? 'Creditnota' : 'Factuur' }} {{ invoice.number }}
                        </h3>
                        <p class="style-description">
                            {{ (invoice.meta.date || invoice.paidAt || invoice.createdAt) | date }}
                        </p>

                        <template #right>
                            <button v-if="invoice.meta.xml && invoice.meta.pdf" v-tooltip="'Download PDF in plaats van XML (niet officieel)'" type="button" class="button icon color-pdf file-pdf" @click.stop="downloadInvoicePdf(invoice)" />
                            <span class="icon download gray" />
                        </template>
                    </STListItem>
                </STList>

                <p v-if="status && status.invoices.length == 0" class="info-box">
                    Je hebt momenteel nog geen facturen ontvangen
                </p>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { STBillingStatus, STCredit, STInvoice } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import GeneralSettingsView from "../GeneralSettingsView.vue";
import CreditsView from "./CreditsView.vue";
import InvoiceDetailsView from "./InvoiceDetailsView.vue";
import MandateSelectionList from "./MandateSelectionList.vue";
import PackageConfirmView from "./PackageConfirmView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        LoadingButton,
        STList,
        STListItem,
        Spinner,
        Checkbox,
        MandateSelectionList
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter),
        capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter)
    }
})
export default class BillingSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    loadingStatus = true

    status: STBillingStatus | null = null

    loading = false

    mounted() {
        UrlHelper.setUrl("/finances/billing");
        this.reload().catch(e => {
            console.error(e)
        })
    }

    get organization() {
        return OrganizationManager.organization
    }

    get companyName() {
        return this.organization.meta.companyName
    }

    get companyAddress() {
        return this.organization.meta.companyAddress || this.organization.address
    }

    get VATNumber() {
        return this.organization.meta.VATNumber
    }

    get companyNumber() {
        return this.organization.meta.companyNumber
    }

    async reload() {
        this.loadingStatus = true

        try {
            this.status = await OrganizationManager.loadBillingStatus({
                owner: this
            })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.loadingStatus = false
    }

    get balance() {
        return this.status ? STCredit.getBalance(this.status.credits) : 0
    }

    downloadInvoice(invoice: STInvoice) {
        const url = invoice.meta.xml ? invoice.meta.xml?.getPublicPath() : invoice.meta.pdf?.getPublicPath()

        if (url) {
            const a = document.createElement("a");
            a.href = url;
            a.target = "_blank"
            a.setAttribute("download", (invoice.meta.date ? (Formatter.dateIso(invoice.meta.date) + " - ") : "")) + "Stamhoofd " + (invoice.number ?? invoice.id);
            a.click();
        } else {
            this.present(new ComponentWithProperties(InvoiceDetailsView, { invoice }).setDisplayStyle("popup"))
            new CenteredMessage("PDF of XML ontbreekt", "Door een technische fout was het niet mogelijk om de PDF of XML van de factuur op te halen. Probeer het later opnieuw. We tonen voorlopig de gegevens van de factuur, maar dit is geen officiële factuur. Neem contact op via "+this.$t('shared.emails.general')+" als dit probleem na één dag nog niet is opgelost.").addCloseButton().show()
        }
        
    }

    downloadInvoicePdf(invoice: STInvoice) {
        const url = invoice.meta.pdf?.getPublicPath()

        if (url) {
            const a = document.createElement("a");
            a.href = url;
            a.target = "_blank"
            a.setAttribute("download", (invoice.meta.date ? (Formatter.dateIso(invoice.meta.date) + " - ") : "")) + "Stamhoofd " + (invoice.number ?? invoice.id);
            a.click();
        } else {
            this.present(new ComponentWithProperties(InvoiceDetailsView, { invoice }).setDisplayStyle("popup"))
            new CenteredMessage("PDF ontbreekt", "Door een technische fout was het niet mogelijk om de PDF van de factuur op te halen. Probeer het later opnieuw. We tonen voorlopig de gegevens van de factuur, maar dit is geen officiële factuur. Neem contact op via "+this.$t('shared.emails.general')+" als dit probleem na één dag nog niet is opgelost.").addCloseButton().show()
        }
    }

    showCreditsHistory() {
        if (!this.status) {
            return
        }
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(CreditsView, {
                status: this.status
            })
        }).setDisplayStyle("popup"))
    }

    openPendingInvoice() {
        if (!this.status?.pendingInvoice) {
            return
        }
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(InvoiceDetailsView, {
                invoice: this.status?.pendingInvoice
            })
        }).setDisplayStyle("popup"))
    }

    linkNewMandate() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PackageConfirmView, {
                allowMandate: false
            })
        }).setDisplayStyle("popup"))
    }

    updateDefaultMandate() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PackageConfirmView, {})
        }).setDisplayStyle("popup"))
    }
    
    get hasFullAccess() {
        return SessionManager.currentSession?.user?.permissions?.hasFullAccess(this.organization.privateMeta?.roles ?? [], ) ?? false
    }

    openGeneralSettings() {
        if (!this.hasFullAccess) {
            return
        }
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(GeneralSettingsView, {
                        organization: this.organization
                    })
                })
            ],
            modalDisplayStyle: "popup",
            animated: true
        })
    }
}
</script>