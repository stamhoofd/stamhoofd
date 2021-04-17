<template>
    <div class="st-view background">
        <STNavigationBar title="Facturen en betalingen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Facturen en betalingen
            </h1>
            <STErrorsDefault :error-box="errorBox" />

            <Spinner v-if="loadingStatus" />
            <template v-else>

                <div class="split-inputs">
                    <div>
                        <STInputBox title="Openstaand bedrag">
                            <p class="button style-price-big" @click="openPendingInvoice">
                                <span>
                                    {{ status.pendingInvoice ? status.pendingInvoice.meta.priceWithoutVAT : 0 | price }}
                                </span>
                                <span class="icon arrow-right" />
                            </p>
                        </STInputBox>
                        <p class="style-description-small">Dit bedrag zal bij jouw volgende afrekening aangerekend worden.</p>
                    </div>

                    <div>
                        <STInputBox title="Jouw tegoed">
                            <p class="style-price-big">
                                {{ status.pendingInvoice ? status.pendingInvoice.meta.priceWithoutVAT : 0 | price }}
                            </p>
                        </STInputBox>
                        <p class="style-description-small">Jouw tegoed wordt automatisch in mindering gebracht op je volgende factuur.</p>
                    </div>
                </div>

                <hr>
                <h2>Facturen</h2>

                <STList v-if="status && status.invoices.length > 0">
                    <STListItem v-for="invoice of status.invoices" :key="invoice.id" :selectable="true">
                        <h3 class="style-title-list">
                            Factuur {{ invoice.number }}
                        </h3>
                        <p v-if="invoice.meta.date" class="style-description">
                            {{ invoice.meta.date | date }}
                        </p>

                        <span slot="right" class="icon download gray" />
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
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, HistoryManager,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ErrorBox,LoadingButton, Spinner, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { STBillingStatus, STPackage, STPackageBundle, STPackageBundleHelper } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Watch } from "vue-property-decorator";

import PackageConfirmView from "./PackageConfirmView.vue";
import PackageDetailsView from "./PackageDetailsView.vue";

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
        Checkbox
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter)
    }
})
export default class BillingSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    loadingStatus = true

    status: STBillingStatus | null = null

    loading = false

    mounted() {
        HistoryManager.setUrl("/settings/billing");
        this.reload().catch(e => {
            console.error(e)
        })
    }


    async reload() {
        this.loadingStatus = true

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/billing/status",
                decoder: STBillingStatus as Decoder<STBillingStatus>
            })
            this.status = response.data
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.loadingStatus = false
    }

    openPendingInvoice() {
        // todo
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
