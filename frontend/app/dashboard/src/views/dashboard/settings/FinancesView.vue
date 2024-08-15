<template>
    <LoadingView v-if="loadingStatus" />
    <div v-else id="finances-view" class="st-view background">
        <STNavigationBar title="Boekhouding" />

        <main class="center">
            <h1>
                Boekhouding
            </h1>

            <STList class="illustration-list">    
                <STListItem v-if="hasFinanceAccess" :selectable="true" class="left-center" @click="openPayments(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/calculator.svg"></template>
                    <h2 class="style-title-list">
                        Betalingen exporteren
                    </h2>
                    <p class="style-description">
                        Alle betalingen, transactiekosten en uitbetalingen die via Stamhoofd verliepen.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="openTransfers(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/check-transfer.svg"></template>
                    <h2 class="style-title-list">
                        Overschrijvingen controleren
                    </h2>
                    <p class="style-description">
                        Markeer overschrijvingen als betaald.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { BackButton, LoadComponent, LoadingView, STList, STListItem, STNavigationBar, TooltipDirective } from "@stamhoofd/components";
import { AccessRight, STBillingStatus, STCredit } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';


import ConfigurePaymentExportView from './administration/ConfigurePaymentExportView.vue';
import ModuleSettingsBox from './ModuleSettingsBox.vue';
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
        return this.$context.organizationAuth.hasAccessRight(AccessRight.OrganizationFinanceDirector)
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

    mounted() {
        this.reload().catch(e => {
            console.error(e)
        })
    }
}
</script>
