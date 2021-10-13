<template>
    <div class="container">
        <div v-for="priceGroup in prices" :key="priceGroup.id" class="container">
            <hr>
            <h2 v-if="!priceGroup.startDate">
                Standaard tarief
            </h2>
            <h2 v-else class="style-with-button">
                <div>
                    Vanaf {{ formatDate(priceGroup.startDate) }}
                </div>
                <div>
                    <button class="button text" @click="removeGroup(priceGroup)">
                        <span class="icon trash" />
                        <span class="hide-smartphone">Verwijderen</span>
                    </button>
                </div>
            </h2>

            <div v-if="priceGroup.startDate !== null" class="split-inputs">
                <STInputBox title="Vanaf" error-fields="startDate" :error-box="errorBox">
                    <DateSelection v-model="priceGroup.startDate" />
                </STInputBox>

                <TimeInput v-model="priceGroup.startDate" title="Tijdstip" placeholder="Tijdstip" :validator="validator" />
            </div>

            <STList>
                <STListItem v-for="(p, index) of priceGroup.prices" :key="index">
                    <div class="split-inputs">
                        <STInputBox :title="priceGroup.prices.length <= 1 ? 'Prijs' : (ordinalNumber(priceGroup, index + 1, priceGroup.prices.length))" error-fields="price" :error-box="errorBox" class="no-padding">
                            <PriceInput :value="p.price" placeholder="Gratis" @input="setPrice(priceGroup, index, $event)" />

                            <button v-if="index > 0 && index == priceGroup.prices.length - 1" slot="right" class="button text" @click="removeFamilyPrice(priceGroup, index)">
                                <span class="icon trash" />
                            </button>
                        </STInputBox>

                        <div>
                            <STInputBox title="Verlaagd tarief*" error-fields="reducedPrice" :error-box="errorBox" class="no-padding">
                                <PriceInput :value="p.reducedPrice" :placeholder="formatPrice(p.price)" :required="false" @input="setReducedPrice(priceGroup, index, $event)" />
                            </STInputBox>
                        </div>
                    </div>
                </STListItem>
            </STList>

            <button v-if="!priceGroup.sameMemberOnlyDiscount || priceGroup.prices.length <= 1" class="button text full" @click="addFamilyPrice(priceGroup)">
                <span class="icon add" />
                <span>Korting voor extra gezinslid</span>
            </button>

            <button v-if="(priceGroup.sameMemberOnlyDiscount || priceGroup.prices.length <= 1) && canRegisterMultipleGroups" class="button text full" @click="addMultipleDiscount(priceGroup)">
                <span class="icon add" />
                <span>
                    Korting voor meerdere inschrijvingen**
                </span>
            </button>


            <p class="style-description-small">
                * Verlaagd tarief voor leden met financiële moeilijkheden. Laat leeg indien je die niet wilt gebruiken.
            </p>

            <template v-if="(priceGroup.sameMemberOnlyDiscount || priceGroup.prices.length <= 1) && canRegisterMultipleGroups">
                <p v-if="category" class="style-description-small">
                    ** Van hetzelfde lid, in de categorie '{{ category.settings.name }}'
                </p>
                <p v-else class="style-description-small">
                    ** Voor hetzelfde lid in dezelfde categorie
                </p>
            </template>
            
            <STInputBox v-if="!priceGroup.sameMemberOnlyDiscount && priceGroup.prices.length > 1" title="Aantal gezinsleden tellen als..." error-fields="genderType" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio :model-value="getOnlySameGroup(priceGroup)" :value="true" @change="setOnlySameGroup(priceGroup, $event)">
                        Gezinsleden die inschrijven voor deze inschrijvingsgroep
                        <template v-if="group">
                            ({{ group.settings.name }})
                        </template>
                    </Radio>

                    <Radio :model-value="getOnlySameGroup(priceGroup)" :value="false" @change="setOnlySameGroup(priceGroup, $event)">
                        Gezinsleden die inschrijven voor gelijk welke inschrijvingsgroep in de bovenliggende categorie
                        <template v-if="category">
                            ({{ category.settings.name }})
                        </template>
                    </Radio>
                </RadioGroup>
            </STInputBox>
        </div>

        <hr>

        <button class="button text" @click="addGroup">
            <span class="icon add" />
            <span v-if="prices.length > 0">Andere prijs na bepaalde datum</span>
            <span v-else>Prijs toevoegen</span>
        </button>
    </div>
</template>

<script lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, DateSelection, ErrorBox, PriceInput, Radio,RadioGroup, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { Group, GroupCategory, GroupPrice, GroupPrices, Organization } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        DateSelection,
        PriceInput,
        Checkbox,
        TimeInput,
        STList,
        STListItem,
        RadioGroup,
        Radio
    }
})
export default class EditGroupPriceBox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    validator: Validator

    @Prop({ default: null })
    errorBox: ErrorBox | null

    /**
     * This array will get changed by emitting patch events that contain a patchablearray
     */
    @Prop({ default: () => [] })
    prices!: GroupPrices[]

    @Prop({ default: null })
    group!: Group | null

    @Prop({ default: null })
    patchedOrganization!: Organization | null

    get canRegisterMultipleGroups() {
        if (!this.group) {
            return true
        }
        const parents = this.group.getParentCategories((this.patchedOrganization ?? OrganizationManager.organization).meta.categories, false)
        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== 1) {
                return true
            }
        }
        return false
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    formatDate(date: Date) {
        const time = Formatter.time(date)
        if (time == "0:00") {
            return Formatter.date(date)
        }
        return Formatter.dateTime(date)
    }

    ordinalNumber(price: GroupPrices, num: number, total: number) {
        if (price.sameMemberOnlyDiscount) {
            return Formatter.capitalizeFirstLetter(Formatter.ordinalNumber(num))+" inschrijving"+(num === total ? " en daarna" : "")+"**"
        }
        return Formatter.capitalizeFirstLetter(Formatter.ordinalNumber(num))+" gezinslid"+(num === total ? " en daarna" : "")
    }

    getPricesPatch(): PatchableArrayAutoEncoder<GroupPrices> {
        return new PatchableArray()
    }

    addPatch(patch: PatchableArrayAutoEncoder<GroupPrices>) {
        this.$emit("patch", patch)
    }

    setPrice(group: GroupPrices, index: number, price: number) {
        const patch = this.getPricesPatch()
        const prices = group.prices.slice()
        prices[index].price = price
        patch.addPatch(GroupPrices.patch({ id: group.id, prices }))
        this.addPatch(patch)
    }

    setReducedPrice(group: GroupPrices, index: number, reducedPrice: number | null) {
        const patch = this.getPricesPatch()
        const prices = group.prices.slice()
        prices[index].reducedPrice = reducedPrice
        patch.addPatch(GroupPrices.patch({ id: group.id, prices }))
        this.addPatch(patch)
    }

    removeGroup(group: GroupPrices) {
        if (group.startDate === null) {
            // Not allowed
            return
        }

        const patch = this.getPricesPatch()
        patch.addDelete(group.id)
        this.addPatch(patch)
    }

    addGroup() {
        const patch = this.getPricesPatch()
        const dd = new Date()
        dd.setHours(0, 0, 0, 0)

        patch.addPut(GroupPrices.create({ 
            startDate: this.prices.length == 0 ? null : dd
         }))
        this.addPatch(patch)
    }

    get category() {
        if (!this.group) {
            return null
        }
        const parents = this.group.getParentCategories((this.patchedOrganization ?? OrganizationManager.organization).meta.categories, false)
        return parents[0] ?? null
    }

    getOnlySameGroup(group: GroupPrices) {
        return group.onlySameGroup
    }

    setOnlySameGroup(group: GroupPrices, onlySameGroup: boolean) {
        const gp = GroupPrices.patch({ id: group.id })
        gp.onlySameGroup = onlySameGroup

        const patch = this.getPricesPatch()
        patch.addPatch(gp)
        this.addPatch(patch)
    }

    addMultipleDiscount(group: GroupPrices) {
        const gp = GroupPrices.patch({ id: group.id })
        gp.prices = [...group.prices, GroupPrice.create(group.prices[group.prices.length - 1] ?? {})]
        gp.sameMemberOnlyDiscount = true
        gp.onlySameGroup = false // other combination is not possible

        const patch = this.getPricesPatch()
        patch.addPatch(gp)
        this.addPatch(patch)
    }

    addFamilyPrice(group: GroupPrices) {
        const gp = GroupPrices.patch({ id: group.id })
        gp.prices = [...group.prices, GroupPrice.create(group.prices[group.prices.length - 1] ?? {})]
        gp.sameMemberOnlyDiscount = false

        const patch = this.getPricesPatch()
        patch.addPatch(gp)
        this.addPatch(patch)
    }

    removeFamilyPrice(group: GroupPrices, index: number){
        if (group.prices.length <= 1) {
            return
        }
        const gp = GroupPrices.patch({ id: group.id })
        gp.prices = [...group.prices]
        gp.prices.splice(index, 1)
        const patch = this.getPricesPatch()
        patch.addPatch(gp)
        this.addPatch(patch)
    }

    /*get price() {
        return this.prices.find(p => p.startDate == null)?.price ?? 0
    }

    set price(price: number) {
        const p = this.prices.find(p => p.startDate == null)

        if (!p) {
            const patch = this.getPricesPatch()
            patch.addPut(GroupPrices.create({ price }))
            this.addPatch(patch)
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, price }))
            this.addPatch(patch)
        }
    }

    get enableReducedPrice() {
        return !!this.prices.find(p => p.reducedPrice !== null)
    }

    set enableReducedPrice(enable: boolean) {
        const patch = this.getPricesPatch()

        for (const price of this.prices) {
            if (!enable) {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, reducedPrice: null}))
            } else {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, reducedPrice: price.price}))
            }
        }

        this.addPatch(patch)
    }

    get enableFamilyPrice() {
        return !!this.prices.find(p => p.familyPrice !== null)
    }

    set enableFamilyPrice(enable: boolean) {
        const patch = this.getPricesPatch()

        for (const price of this.prices) {
            if (!enable) {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice: null, extraFamilyPrice: null }))
            } else {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice: price.price, extraFamilyPrice: price.price }))
            }
        }

        this.addPatch(patch)
    }

    get familyPrice() {
        return this.prices.find(p => p.startDate == null)?.familyPrice ?? 0
    }

    set familyPrice(familyPrice: number) {
        const patch = this.getPricesPatch()

        for (const price of this.prices) {
            patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice }))
        }

        this.addPatch(patch)
    }

    get extraFamilyPrice() {
        return this.prices.find(p => p.startDate == null)?.extraFamilyPrice ?? 0
    }

    set extraFamilyPrice(extraFamilyPrice: number) {
        const patch = this.getPricesPatch()

        for (const price of this.prices) {
            patch.addPatch(GroupPrices.patchType().create({ id: price.id, extraFamilyPrice }))
        }

        this.addPatch(patch)
    }

    get reducedPrice() {
        return this.prices.find(p => p.startDate == null)?.reducedPrice ?? 0
    }

    set reducedPrice(reducedPrice: number) {
        const p = this.prices.find(p => p.startDate == null)

        if (!p) {
            const patch = this.getPricesPatch()
            patch.addPut(GroupPrices.create({ reducedPrice }))
            this.addPatch(patch)
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, reducedPrice }))
            this.addPatch(patch)
        }
    }

    get enableLatePrice() {
        return !!this.prices.find(p => p.startDate !== null)
    }

    set enableLatePrice(enable: boolean) {
        const p = this.prices.find(p => p.startDate !== null)

        if (!enable) {
            if (p) {
                const patch = this.getPricesPatch()
                patch.addDelete(p.id)
                this.addPatch(patch)
            }
            return
        } else {
            if (!p) {
                const patch = this.getPricesPatch()
                // todo: better default date
                patch.addPut(GroupPrices.create({ 
                    startDate: new Date(), 
                    price: this.price, 
                    reducedPrice: this.enableReducedPrice ? this.reducedPrice : null, 
                    familyPrice: this.enableFamilyPrice ? this.familyPrice : null, 
                    extraFamilyPrice: this.enableFamilyPrice ? this.extraFamilyPrice : null
                }))
                this.addPatch(patch)
            }
        }
    }

    get latePrice() {
        return this.prices.find(p => p.startDate !== null)?.price ?? 0
    }

    set latePrice(price: number) {
        const p = this.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, price }))
            this.addPatch(patch)
        }
    }

    get reducedLatePrice() {
        return this.prices.find(p => p.startDate !== null)?.reducedPrice ?? 0
    }

    set reducedLatePrice(reducedPrice: number) {
        const p = this.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, reducedPrice }))
            this.addPatch(patch)
        }
    }

    get latePriceDate() {
        return this.prices.find(p => p.startDate !== null)?.startDate ?? new Date()
    }

    set latePriceDate(startDate: Date) {
        const p = this.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, startDate }))
            this.addPatch(patch)
        }
    }*/
}
</script>
