<template>
    <LoadingView v-if="loadingStatus" />
    <div v-else id="finances-view" class="st-view background">
        <STNavigationBar title="Boekhouding" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Boekhouding
            </h1>

            <STList class="illustration-list">    
                <STListItem v-if="hasFinanceAccess" :selectable="true" class="left-center" @click="openPayments(true)">
                    <img slot="left" src="@stamhoofd/assets/images/illustrations/calculator.svg">
                    <h2 class="style-title-list">
                        Betalingen exporteren
                    </h2>
                    <p class="style-description">
                        Alle betalingen, transactiekosten en uitbetalingen die via Stamhoofd verliepen.
                    </p>
                    <template slot="right">
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openTransfers(true)">
                    <img slot="left" src="@stamhoofd/assets/images/illustrations/check-transfer.svg">
                    <h2 class="style-title-list">
                        Overschrijvingen controleren
                    </h2>
                    <p class="style-description">
                        Markeer overschrijvingen als betaald.
                    </p>
                    <template slot="right">
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="hasFinanceAccess">
                <hr>
                <h2>Betalingen aan Stamhoofd</h2>
                <BillingWarningBox v-if="hasFinanceAccess" @billing="openPendingInvoice(true)" />

                <STList class="illustration-list">    
                    <STListItem v-if="status && status.pendingInvoice && status.pendingInvoice.meta.priceWithoutVAT" :selectable="true" class="left-center right-stack" @click="openPendingInvoice(true)">
                        <img slot="left" src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg">
                        <h2 v-if="!isPaymentFailed" class="style-title-list">
                            Volgende aanrekening
                        </h2>
                        <h2 v-else class="style-title-list">
                            Openstaand bedrag
                        </h2>
                        <p v-if="!isPaymentFailed" class="style-description">
                            Dit bedrag zal bij jouw volgende afrekening automatisch afgerekend worden.
                        </p>
                        <p v-else class="style-description">
                            Betaal je openstaande bedrag.
                        </p>
                        <template slot="right">
                            <span v-if="!isPaymentFailed" class="style-description-small">
                                {{ status.pendingInvoice.meta.priceWithoutVAT | price }}
                            </span>
                            <span v-else class="style-tag error">
                                {{ status.pendingInvoice.meta.priceWithoutVAT | price }}
                            </span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="status && status.credits.length" :selectable="true" class="left-center" @click="showCreditsHistory(true)">
                        <img slot="left" src="@stamhoofd/assets/images/illustrations/credits.svg">
                        <h2 class="style-title-list">
                            Tegoed
                        </h2>
                        <p class="style-description">
                            Dit bedrag zal automatisch gebruikt worden om jouw volgende aankoop te betalen.
                        </p>
                        <template slot="right">
                            <span class="style-description-small">
                                {{ balance | price }}
                            </span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="openPackages(true)">
                        <img slot="left" src="@stamhoofd/assets/images/illustrations/stock.svg">
                        <h2 class="style-title-list">
                            Pakketten aankopen
                        </h2>
                        <p class="style-description">
                            Wijzig je pakketten of activeer nieuwe functies
                        </p>
                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="openBilling(true)">
                        <img slot="left" src="@stamhoofd/assets/images/illustrations/transfer.svg">
                        <h2 class="style-title-list">
                            Facturen en betalingen
                        </h2>
                        <p class="style-description">
                            Download jouw facturen en bekijk jouw tegoed.
                        </p>
                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadComponent, LoadingView,STList, STListItem, STNavigationBar, TooltipDirective } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { STBillingStatus, STCredit } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";


import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';
import ModuleSettingsBox from './ModuleSettingsBox.vue';
import BillingSettingsView from './packages/BillingSettingsView.vue';
import BillingWarningBox from './packages/BillingWarningBox.vue';
import PackageSettingsView from "./packages/PackageSettingsView.vue";

@Component({
    components: {
        STNavigationBar,
        BackButton,
        STList,
        STListItem,
        ModuleSettingsBox,
        BillingWarningBox,
        LoadingView
    },
    directives: {
        tooltip: TooltipDirective,
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
})
export default class FinancesView extends Mixins(NavigationMixin) {
    loadingStatus = true

    status: STBillingStatus | null = null

    async reload() {
        this.loadingStatus = true

        try {
            if (this.hasFinanceAccess) {
                this.status = await this.$organizationManager.loadBillingStatus({
                    owner: this
                })
            }
        } catch (e) {
            console.error(e)
        }

        this.loadingStatus = false
    }

    get paymentFailedDeactivateDate() {
        let d: Date | null = null
        for (const [_, pack] of this.organization.meta.packages.packages) {
            if (pack.deactivateDate === null || pack.firstFailedPayment === null) {
                continue
            }
            if (d && d < pack.deactivateDate) {
                continue
            }
            d = pack.deactivateDate
        }
        return d
    }
    
    get isPaymentFailed() {
        return this.paymentFailedDeactivateDate !== null
    }

    get organization() {
        return this.$organization
    }

    get hasFinanceAccess() {
        return this.$user!.permissions!.hasFinanceAccess(this.organization.privateMeta?.roles ?? [])
    }

    get balance() {
        return this.status ? STCredit.getBalance(this.status.credits) : 0
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }

    async openPendingInvoice(animated = true) {
        if (!this.status?.pendingInvoice) {
            return
        }
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: await LoadComponent(() => import(/* webpackChunkName: "InvoiceDetailsView", webpackPrefetch: true */ './packages/InvoiceDetailsView.vue'), {
                        invoice: this.status?.pendingInvoice
                    }, { instant: !animated })
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    async showCreditsHistory(animated = true) {
        if (!this.status) {
            return
        }
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: await LoadComponent(() => import(/* webpackChunkName: "CreditsView", webpackPrefetch: true */ './packages/CreditsView.vue'), {
                        status: this.status
                    }, { instant: !animated })
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    async openTransfers(animated = true) {
        this.show({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "TransferPaymentsView", webpackPrefetch: true */ '../payments/TransferPaymentsView.vue'), {}, { instant: !animated })
                })
            ]
        });
    }

    openPayments(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ConfigurePaymentExportView, {})
                })
            ]
        })
    }

    openBilling(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(BillingSettingsView, {})
                })
            ]
        })
    }

    openPackages(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(PackageSettingsView, {})
                })
            ]
        })
    }

    mounted() {
        this.reload().catch(e => {
            console.error(e)
        })

        const parts = UrlHelper.shared.getParts()

        // First set current url already, to fix back
        UrlHelper.setUrl("/finances")
        document.title = "Stamhoofd - Boekhouding"

        if (parts.length == 2 && parts[0] == 'finances' && parts[1] == 'transfers') {
            // Open mollie settings
            this.openTransfers(false).catch(console.error)
        }

    
        if (parts.length == 2 && parts[0] == 'finances' && parts[1] == 'billing') {
            this.openBilling(false)
        }

        if (parts.length == 2 && parts[0] == 'finances' && parts[1] == 'packages') {
            this.openPackages(false)
        }

        UrlHelper.shared.clear()
    }
}
</script>