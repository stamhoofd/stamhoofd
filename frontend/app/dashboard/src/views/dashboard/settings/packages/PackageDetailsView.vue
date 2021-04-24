<template>
    <div class="st-view background">
        <STNavigationBar :title="pack.meta.name">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                {{ pack.meta.name }}
            </h1>

            <p>
                Alle bedragen zijn excl. BTW, tenzij anders vermeld.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <STList v-if="pack.meta.pricingType === 'PerMember'">
                <STListItem>
                    Aantal leden

                    <template slot="right">
                        {{ pack.meta.paidAmount }}
                    </template>
                </STListItem>

                <STListItem>
                    Prijs

                    <template slot="right">
                        {{ pack.meta.unitPrice | price }} / jaar / lid
                    </template>
                </STListItem>

                <STListItem>
                    Minimum bedrag per jaar

                    <template slot="right">
                        {{ pack.meta.minimumAmount * pack.meta.unitPrice | price }} 
                        ({{ pack.meta.minimumAmount }} leden)
                    </template>
                </STListItem>

                <STListItem>
                    Vanaf

                    <template slot="right">
                        {{ pack.meta.startDate | date }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.validUntil">
                    Geldig tot

                    <template slot="right">
                        {{ pack.validUntil | date }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.removeAt && pack.meta.canRenew && !isValid">
                    Vervalt op

                    <template slot="right">
                        {{ pack.removeAt | date }}
                    </template>
                </STListItem>
            </STList>

            <STList v-else-if="pack.meta.pricingType === 'PerYear'">
                <STListItem>
                    Prijs

                    <template slot="right">
                        {{ pack.meta.unitPrice | price }} / jaar
                    </template>
                </STListItem>

                <STListItem>
                    Vanaf

                    <template slot="right">
                        {{ pack.meta.startDate | date }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.validUntil">
                    Geldig tot

                    <template slot="right">
                        {{ pack.validUntil | date }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.removeAt && pack.meta.canRenew && !isValid">
                    Vervalt op

                    <template slot="right">
                        {{ pack.removeAt | date }}
                    </template>
                </STListItem>
            </STList>

            <STList v-else-if="pack.meta.pricingType === 'Fixed'">
                <STListItem>
                    Prijs

                    <template slot="right">
                        {{ pack.meta.unitPrice | price }}
                    </template>
                </STListItem>

                <STListItem>
                    Vanaf

                    <template slot="right">
                        {{ pack.meta.startDate | date }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.validUntil">
                    Geldig tot

                    <template slot="right">
                        {{ pack.validUntil | date }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.removeAt && pack.meta.canRenew && !isValid">
                    Vervalt op

                    <template slot="right">
                        {{ pack.removeAt | date }}
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton v-if="pack.meta.canRenew" :loading="loading">
                    <button class="button primary">
                        Verlengen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { STPackage } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        LoadingButton,
        STList,
        STListItem
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter)
    }
})
export default class PackageDetailsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    pack: STPackage

    errorBox: ErrorBox | null = null
    validator = new Validator()

    loading = false


    async extend() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            await Promise.resolve()
            /*const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/billing/activate-packages",
                body: {
                    bundles: this.selectedPackages.map(p => p.bundle),
                    paymentMethod: this.selectedPaymentMethod
                },
                decoder: STInvoiceResponse as Decoder<STInvoiceResponse>
            })
            if (response.data.paymentUrl) {
                window.location.href = response.data.paymentUrl;
            } else {
                // Go to invoice page
            }*/
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }


        this.loading = false
    }

    get isValid() {
        return this.pack.validUntil === null || this.pack.validUntil > new Date()
    }
  
    shouldNavigateAway() {
        // todo
        if (this.loading) {
            return false
        }
        return true
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
