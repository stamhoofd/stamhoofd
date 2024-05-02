<template>
    <div class="st-view organization-view">
        <STNavigationBar title="Facturatie" />

        <main>
            <h1>
                <span>Facturatie</span>
            </h1>

            <div class="split-inputs">
                <div>
                    <STInputBox title="Openstaand bedrag">
                        <p class="button style-price-big" @click="openPendingInvoice">
                            <span>
                                {{ formatPrice(organization.billingStatus.pendingInvoice ? organization.billingStatus.pendingInvoice.meta.priceWithoutVAT : 0) }}
                            </span>
                            <span v-if="organization.billingStatus.pendingInvoice && organization.billingStatus.pendingInvoice.meta.priceWithoutVAT > 0" class="icon arrow-right" />
                        </p>
                    </STInputBox>
                </div>

                <div>
                    <STInputBox title="Tegoed">
                        <p class="style-price-big" @click="openCredits">
                            {{ formatPrice(balance) }}
                            <span class="icon arrow-right" />
                        </p>
                    </STInputBox>
                </div>
            </div>

            <div class="container">
                <hr>
                <h2>
                    Domiciliëring
                </h2>

                <STList>
                    <STListItem v-for="mandate of mandates" :key="mandate.id" class="left-center">
                        <template #left>
                            <figure class="registration-image">
                                <figure>
                                    <span>💳</span>
                                </figure>
                                <div>
                                    <span v-if="mandate.status == 'valid'" class="icon green success" />
                                    <span v-else-if="mandate.status == 'invalid'" class="icon red error" />
                                    <span v-else class="icon gray clock" />
                                </div>
                            </figure>
                        </template>
                        <h3 class="style-title-list">
                            {{ mandate.details.consumerAccount || "/" }}
                        </h3>
                        <p v-if="mandate.details.consumerName" class="style-description-small">
                            {{ mandate.details.consumerName }}
                        </p>
                        <p v-if="mandate.details.consumerBic" class="style-description-small">
                            {{ mandate.details.consumerBic }}
                        </p>
                        <p class="style-description-small">
                            {{ mandate.id }}
                        </p>
                    </STListItem>
                </STList>
                <p v-if="mandates.length == 0" class="warning-box">
                    Geen geldige mandaten gevonden
                </p>
            </div>

            <div class="container member-registration-block">
                <hr>
                <h2 class="style-with-button">
                    <div>Pakketten</div>
                    <div class="hover-show">
                        <button class="button icon gray add" type="button" @click="createPackage()" />
                    </div>
                </h2>

                <STList v-if="organization.billingStatus.packages.length > 0">
                    <STListItem v-for="pack in organization.billingStatus.packages" :key="pack.id" class="left-center" :selectable="true" @click="editPackage(pack)">
                        <template #left>
                            <figure class="registration-image">
                                <figure>
                                    <span>{{ pack.meta.name.substr(0, 2) }}</span>
                                </figure>
                                <div>
                                    <span v-if="pack.meta.paymentFailedCount > 0" class="icon red error" />
                                    <span v-else-if="pack.status.isActive" class="icon green success" />
                                </div>
                            </figure>
                        </template>
                        <h3 class="style-title-list">
                            {{ pack.meta.name }}
                        </h3>
                        <p v-if="pack.meta.startDate" class="style-description-small">
                            Vanaf {{ formatDateTime(pack.meta.startDate) }}
                        </p>
                        <p v-if="pack.validUntil" class="style-description-small">
                            Geldig tot {{ formatDateTime(pack.validUntil) }}
                        </p>
                    </STListItem>
                </STList>
                <p v-else class="info-box">
                    Geen pakketten actief
                </p>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, LoadingView, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { OrganizationSummary, STBillingStatus, STPackage, STPackageBundle, STPackageBundleHelper, STPendingInvoicePrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import InvoiceView from "../invoices/InvoiceView.vue";
import CreditsView from "./CreditsView.vue";
import EditPackageView from "./EditPackageView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        LoadingView,
        STInputBox
    },
    filters: {
        price: Formatter.price,
        dateTime: Formatter.dateTime.bind(Formatter)
    },
    directives: { Tooltip },
})
export default class OrganizationInvoicesView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        organization!: OrganizationSummary

    loading = false

    get mandates() {
        return this.organization?.paymentMandates ?? []
    }

    get balance() {
        return this.organization?.billingStatus?.credits.slice().reverse().reduce((t, c) => {
            if (c.expireAt !== null && c.expireAt < new Date()) {
                return t
            }
            const l = t + c.change
            if (l < 0) {
                return 0
            }
            return l
        }, 0) ?? 0
    }

    async unlinkMollie() {
        try {
            if (!await CenteredMessage.confirm("Weet je zeker dat je deze mollie customer wilt ontkoppelen?", "Ja, ontkoppelen")) {
                return
            }

            await this.patch(OrganizationSummary.patch({
                mollieCustomerId: null
            }))
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    openPendingInvoice() {
        if (!this.organization?.billingStatus.pendingInvoice) {
            return
        }
        const invoice = STPendingInvoicePrivate.create({ ...this.organization!.billingStatus.pendingInvoice!, organization: this.organization })
        this.present(new ComponentWithProperties(InvoiceView, {
            invoice
        }).setDisplayStyle("popup"))
    }

    openCredits() {
        this.present(new ComponentWithProperties(CreditsView, {
            organization: this.organization!
        }).setDisplayStyle("popup"))
    }

    editPackage(pack: STPackage) {
        this.present(new ComponentWithProperties(EditPackageView, { 
            pack, 
            organization: this.organization,
            isNew: false,
            saveHandler: async (patch: AutoEncoderPatchType<OrganizationSummary>) => {
                await this.patch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    createPackage() {
        const pack = STPackageBundleHelper.getCurrentPackage(STPackageBundle.Members, new Date())
        pack.validAt = new Date()

        const billingStatusPatch = STBillingStatus.patch({})
        billingStatusPatch.packages.addPut(pack)
        const organizationPatch = OrganizationSummary.patch({
            billingStatus: billingStatusPatch
        })

        this.present(new ComponentWithProperties(EditPackageView, { 
            pack, 
            organization: this.organization!.patch(organizationPatch),
            isNew: true,
            saveHandler: async (patch: AutoEncoderPatchType<OrganizationSummary>) => {
                const merged = organizationPatch.patch(patch)
                await this.patch(merged)
            }
        }).setDisplayStyle("popup"))
    }

    async patch(patch: AutoEncoderPatchType<OrganizationSummary>) {
        const response = await AdminSession.shared.authenticatedServer.request({
            method: "PATCH",
            path: "/organizations/"+this.organization.id,
            body: patch,
            decoder: OrganizationSummary as Decoder<OrganizationSummary>
        })
        this.organization = response.data
    }
}
</script>