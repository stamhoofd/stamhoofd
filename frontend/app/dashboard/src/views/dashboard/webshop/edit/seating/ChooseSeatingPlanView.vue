<template>
    <SaveView title="Zaalplan" :disabled="!hasChanges" @save="save">
        <h1>
            Kies een zaalplan
        </h1>
        <p>
            Je kan een zaalplan aanmaken of een bestaand zaalplan kiezen. Je kan in de loop van een evenement wijzigingen maken aan een zaalplan of zelfs een ander zaalplan kiezen op voorwaarde dat dezelfde rij en zetelnummers gebruikt worden.
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

            <STListItem v-for="plan in allSeatingPlans" :key="plan.id" :selectable="true" element-name="label">
                <Radio slot="left" v-model="selectedPlan" :value="plan.id" />

                <h3 class="style-title-list">
                    {{ plan.name }}
                </h3>
                <p v-if="plan.seatCount > 1" class="style-description-small">
                    {{ plan.seatCount }} plaatsen
                </p>

                <p v-if="isFromOtherWebshop(plan)" class="style-description-small">
                    Dit zaalplan is van een andere webshop. Door het te kiezen wordt een kopie toegevoegd aan deze webshop. Aanpassingen worden niet overgenomen in bestaande webshops.
                </p>
                

                <template #right>
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

        <hr>

        <h2>Acties</h2>

        <STList class="illustration-list">    
            <STListItem :selectable="true" class="left-center" element-name="label">
                <input type="file" multiple="multiple" style="display: none;" accept=".plan" @change="importSeatingPlan">
                <template #left><img src="@stamhoofd/assets/images/illustrations/box-upload.svg"></template>
                <h2 class="style-title-list">
                    Importeer zaalplan
                </h2>
                <p class="style-description">
                    Importeer een zaalplan dat jij of een andere vereniging eerder uit Stamhoofd hebt geëxporteerd. Importeren vanaf andere systemen is niet mogelijk.
                </p>
                <LoadingButton slot="right" :loading="importingSeatingPlan">
                    <span class="icon download gray" />
                </LoadingButton>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder,ObjectData,patchContainsChanges, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, LoadingButton,Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { PrivateWebshop, Product, SeatingPlan, SeatingPlanCategory, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, SeatType, Version, WebshopMetaData } from "@stamhoofd/structures";
import { Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";


import EditSeatingPlanView from './EditSeatingPlanView.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        Radio,
        STList,
        STListItem,
        LoadingButton
    },
})
export default class ChooseSeatingPlanView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    importingSeatingPlan = false

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
        return this.$organization
    }

    addPatch(patch: AutoEncoderPatchType<Product>) {
        this.patchProduct = this.patchProduct.patch(patch)
    }

    isFromOtherWebshop(seatingPlan: SeatingPlan) {
        return !this.patchedWebshop.meta.seatingPlans.find(p => p.id == seatingPlan.id)
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }

        // If seating plan is not yet added to webshop, add it.
        const added = this.addSeatingPlanIfNotInWebshop(this.selectedPlan)
        if (added) {
            // We assigned a new id to this seating plan
            const {webshopPatch, id} = added
            this.addPatch(Product.patch({ seatingPlanId: id }))
            this.patchWebshop = this.patchWebshop.patch(webshopPatch)
        }

        this.saveHandler(this.patchProduct, this.patchWebshop)
        this.pop({ force: true })
    }

    addSeatingPlanIfNotInWebshop(id: string|null) {
        // If seating plan is not yet added to webshop, add it.
        if (id && !this.patchedWebshop.meta.seatingPlans.find(p => p.id == id)) {
            let seatingPlan = this.allSeatingPlans.find(p => p.id == id)
            if (!seatingPlan) {
                throw new Error("Seating plan not found")
            }

            // Give the seating plan a new unique id
            seatingPlan = seatingPlan.patch({id: SeatingPlan.create({}).id})

            const webshopMetaPatch = WebshopMetaData.patch({})
            webshopMetaPatch.seatingPlans.addPut(seatingPlan)
            const webshopPatch = PrivateWebshop.patch({meta: webshopMetaPatch})
            return {webshopPatch, id: seatingPlan.id}
        }
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

    get otherWebshopSeatingPlans() {
        const seatingPlans = this.organization.webshops.filter(w => w.id != this.webshop.id).flatMap(w => w.meta.seatingPlans)

        // If seating plans have the same name, only show the last changed one
        const map = new Map<string, SeatingPlan>()
        for (const seatingPlan of seatingPlans) {
            map.set(seatingPlan.name, seatingPlan)
        }

        return Array.from(map.values())
    }

    get allSeatingPlans() {
        // Unique by name
        const map = new Map<string, SeatingPlan>()
        const usedIds = new Set<string>()
        const reservedIds = new Set<string>()

        for (const seatingPlan of this.seatingPlans) {
            reservedIds.add(seatingPlan.id)
        }

        for (const seatingPlan of this.otherWebshopSeatingPlans) {
            if (usedIds.has(seatingPlan.id) || reservedIds.has(seatingPlan.id)) {
                continue
            }
            map.set(seatingPlan.name, seatingPlan)
            usedIds.add(seatingPlan.id)
        }

        for (const seatingPlan of this.seatingPlans) {
            if (usedIds.has(seatingPlan.id)) {
                continue
            }
            map.set(seatingPlan.name, seatingPlan)
            usedIds.add(seatingPlan.id)
        }

        return Array.from(map.values()).sort((a, b) => Sorter.byStringProperty(a, b, 'name'))
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
        const added = this.addSeatingPlanIfNotInWebshop(seatingPlan.id)
        const patched = added ?? {
            webshopPatch: PrivateWebshop.patch({}),
            id: seatingPlan.id
        }

        const seatingPlanPatched = seatingPlan.patch({id: patched.id})

        this.present({
            components: [
                new ComponentWithProperties(EditSeatingPlanView, {
                    webshop: this.patchedWebshop.patch(patched.webshopPatch),
                    seatingPlan: seatingPlanPatched,
                    isNew: !!added,
                    saveHandler: (patchedWebshop: AutoEncoderPatchType<PrivateWebshop>) => {
                        this.patchWebshop = this.patchWebshop.patch(patched.webshopPatch).patch(patchedWebshop)
                        this.selectedPlan = seatingPlanPatched.id
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    async importSeatingPlan(event) {
        if (this.importingSeatingPlan) {
            return
        }

        if (!event.target.files || event.target.files.length == 0) {
            return;
        }

        const files = event.target.files as FileList
        const file = files[0]
        this.importingSeatingPlan = true

        try {
            const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
            const data = await JSZip.loadAsync(file);
            const jsonFile = data.file('plan.json');

            if (!jsonFile) {
                this.importingSeatingPlan = false
                new CenteredMessage("Dit is geen geldig zaalplan uit Stamhoofd").addCloseButton().show()
                return
            }

            const blob = await jsonFile.async("blob")
            const text = await blob.text();

            const json = JSON.parse(text)

            // Decode
            const decoded = new VersionBoxDecoder(SeatingPlan as Decoder<SeatingPlan>).decode(new ObjectData(json, {version: 0}))

            const seatingPlan = decoded.data

            // Asign a unique id to the seating plan
            const r = SeatingPlan.create({})
            seatingPlan.id = r.id

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
            
        } catch (e) {
            console.error(e)
            new Toast('Er is iets misgelopen bij het importeren van het zaalplan. Kijk na of het bestand dat je hebt gekozen wel uit Stamhoofd afkomstig is.', 'error red')
        } finally {
            this.importingSeatingPlan = false
        }

        // Clear selection
        event.target.value = null;
    }

    
}
</script>
