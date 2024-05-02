<template>
    <div class="st-view">
        <STNavigationBar title="Tegoed geschiedenis" :disableDismiss="canPop">
            <template #right class="button text" @click="createCredit">
                <span class="icon add" />
                <span>Nieuw</span>
            </template>
        </STNavigationBar>
        
        <main>
            <h1>
                <span>Tegoed geschiedenis</span>
            </h1>

            <p v-if="credits.length == 0" class="info-box">
                Geen tegoed geschiedenis
            </p>

            <STList v-else>
                <STListItem v-for="credit in credits" :key="credit.id" :selectable="true" @click="editCredit(credit)">
                    <h3 class="style-title-list">
                        {{ credit.description }}
                    </h3>
                    <p class="style-description">
                        {{ formatDateTime(credit.createdAt) }}
                    </p>
                    <p v-if="credit.expireAt" class="style-description">
                        Vervalt op {{ formatDateTime(credit.expireAt) }}
                        <span v-if="isExpired(credit)" class="style-tag error">Vervallen</span>
                    </p>
                    <template #right>
                        {{ formatPriceChange(credit.change) }}
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { OrganizationSummary, STBillingStatus, STCredit } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import EditCreditView from "./EditCreditView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        BackButton,
    },
    filters: {
        priceChange: Formatter.priceChange.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    },
})
export default class CreditsView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    organization!: OrganizationSummary

    get credits() {
        return this.organization.billingStatus.credits
    }

    editCredit(credit: STCredit) {
        this.present(new ComponentWithProperties(EditCreditView, { 
            credit, 
            organization: this.organization,
            isNew: false,
            saveHandler: async (patch: AutoEncoderPatchType<OrganizationSummary>) => {
                await this.patch(patch)
            }
        }).setDisplayStyle("sheet"))
    }

    isExpired(credit: STCredit) {
        return credit.expireAt !== null && credit.expireAt < new Date()
    }

    createCredit() {
        const credit = STCredit.create({})

        const billingStatusPatch = STBillingStatus.patch({})
        billingStatusPatch.credits.addPut(credit)
        const organizationPatch = OrganizationSummary.patch({
            billingStatus: billingStatusPatch
        })

        this.present(new ComponentWithProperties(EditCreditView, { 
            credit, 
            organization: this.organization!.patch(organizationPatch),
            isNew: true,
            saveHandler: async (patch: AutoEncoderPatchType<OrganizationSummary>) => {
                const merged = organizationPatch.patch(patch)
                await this.patch(merged)
            }
        }).setDisplayStyle("sheet"))
    }

    async patch(patch: AutoEncoderPatchType<OrganizationSummary>) {
        const response = AdminSession.shared.authenticatedServer.request({
            method: "PATCH",
            path: "/organizations/"+this.organization.id,
            body: patch,
            decoder: OrganizationSummary as Decoder<OrganizationSummary>
        })
        this.organization.set((await response).data)
    }
}
</script>