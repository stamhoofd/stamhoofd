<template>
    <SaveView title="Zaalplan" :disabled="!hasChanges" @save="save">
        <h1>
            Kies een zaalplan
        </h1>
        <p>
            Je kan een zaalplan aanmaken of een bestaand zaalplan kiezen.
        </p>

        <p class="info-box icon gift">
            De zetelselectie functie is nu nog even gratis voor alle webshops die je nu al aanmaakt.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <Radio slot="left" v-model="selectedPlan" :value="null" />

                <h3 class="style-title-list">
                    Geen zetelselectie
                </h3>
                <p class="style-description-small">
                    Er worden geen plaatsen aan tickets gekoppeld.
                </p>
            </STListItem>

            <STListItem v-for="plan in seatingPlans" :key="plan.id" :selectable="true" element-name="label">
                <Radio slot="left" v-model="selectedPlan" :value="plan.id" />

                <h3 class="style-title-list">
                    {{ plan.name }}
                </h3>

                <template slot="right">
                    <button class="button icon edit gray" type="button" @click="editSeatingPlan(plan)" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addSeatingPlan">
                <span class="icon add" />
                <span>Zaalplan aanmaken</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { PrivateWebshop, Product, SeatingPlan, SeatingPlanCategory, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, SeatType, Version, WebshopMetaData } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../../classes/OrganizationManager';
import EditSeatingPlanView from './EditSeatingPlanView.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        Radio,
        STList,
        STListItem
    },
})
export default class ChooseSeatingPlanView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        product!: Product

    @Prop({ required: true })
        webshop: PrivateWebshop

    /// For now only used to update locations and times of other products that are shared
    patchWebshop:  AutoEncoderPatchType<PrivateWebshop> = PrivateWebshop.patch({})
    patchProduct: AutoEncoderPatchType<Product> = Product.patch({ id: this.product.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (patchProduct: AutoEncoderPatchType<Product>, patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get patchedWebshop() {
        return this.webshop.patch(this.patchWebshop)
    }

    get patchedProduct() {
        return this.product.patch(this.patchProduct)
    }

    get organization() {
        return OrganizationManager.organization
    }

    addPatch(patch: AutoEncoderPatchType<Product>) {
        this.patchProduct = this.patchProduct.patch(patch)
    }


    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }
        this.saveHandler(this.patchProduct, this.patchWebshop)
        this.pop({ force: true })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchProduct, this.product, { version: Version }) || patchContainsChanges(this.patchWebshop, this.webshop, { version: Version })
    }

    get selectedPlan() {
        return this.patchedProduct.seatingPlanId
    }

    set selectedPlan(seatingPlanId: string | null) {
        this.addPatch(Product.patch({ seatingPlanId }))
    }

    get seatingPlans() {
        return this.patchedWebshop.meta.seatingPlans
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    addSeatingPlan() {
        const seatingPlan = SeatingPlan.create({
            name: "",
            categories: [
                SeatingPlanCategory.create({
                    id: '0',
                    name: "Standaard",
                    price: 0
                })
            ],
            sections: [
                SeatingPlanSection.create({
                    name: "",
                    rows: [
                        SeatingPlanRow.create({
                            label: 'B',
                            seats: [
                                SeatingPlanSeat.create({
                                    label: '1',
                                    category: '0'
                                })
                            ]
                        }),
                        SeatingPlanRow.create({
                            label: 'A',
                            seats: [
                                SeatingPlanSeat.create({
                                    label: '1',
                                    category: '0'
                                })
                            ]
                        }),
                        // Empty row
                        SeatingPlanRow.create({
                            seats: []
                        }),
                        // Podium
                        SeatingPlanRow.create({
                            seats: [
                                SeatingPlanSeat.create({
                                    label: 'Podium',
                                    grow: 1,
                                    type: SeatType.Space
                                })
                            ]
                        })
                    ]
                })
            ]
        });
        
        
        const webshopMetaPatch = WebshopMetaData.patch({})
        webshopMetaPatch.seatingPlans.addPut(seatingPlan)
        const webshopPatch = PrivateWebshop.patch({meta: webshopMetaPatch})


        this.present({
            components: [
                new ComponentWithProperties(EditSeatingPlanView, {
                    webshop: this.patchedWebshop.patch(webshopPatch),
                    seatingPlan,
                    isNew: true,
                    saveHandler: (patchedWebshop: AutoEncoderPatchType<PrivateWebshop>) => {
                        this.patchWebshop = this.patchWebshop.patch(webshopPatch).patch(patchedWebshop)
                        this.selectedPlan = seatingPlan.id
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    editSeatingPlan(seatingPlan: SeatingPlan) {
        this.present({
            components: [
                new ComponentWithProperties(EditSeatingPlanView, {
                    webshop: this.patchedWebshop,
                    seatingPlan,
                    isNew: false,
                    saveHandler: (patchedWebshop: AutoEncoderPatchType<PrivateWebshop>) => {
                        this.patchWebshop = this.patchWebshop.patch(patchedWebshop)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    
}
</script>
