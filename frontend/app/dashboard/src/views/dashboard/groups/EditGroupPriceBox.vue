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
                    <button class="button text" type="button" @click="removeGroup(priceGroup)">
                        <span class="icon trash" />
                        <span class="hide-smartphone">Verwijderen</span>
                    </button>
                </div>
            </h2>

            <div v-if="priceGroup.startDate !== null" class="split-inputs">
                <STInputBox title="Vanaf" error-fields="startDate" :error-box="errorBox">
                    <DateSelection :value="priceGroup.startDate" @input="setStartDate(priceGroup, $event)" />
                </STInputBox>

                <TimeInput :value="priceGroup.startDate" title="Tijdstip" placeholder="Tijdstip" :validator="validator" @input="setStartDate(priceGroup, $event)" />
            </div>

            <STList>
                <STListItem v-for="(p, index) of priceGroup.prices" :key="index">
                    <div class="split-inputs">
                        <STInputBox :title="priceGroup.prices.length <= 1 ? 'Prijs' : (ordinalNumber(priceGroup, index + 1, priceGroup.prices.length))" error-fields="price" :error-box="errorBox">
                            <PriceInput :value="p.price" placeholder="Gratis" @input="setPrice(priceGroup, index, $event)" />

                            <button v-if="index > 0 && index == priceGroup.prices.length - 1" slot="right" type="button" class="button text" @click="removeFamilyPrice(priceGroup, index)">
                                <span class="icon trash" />
                            </button>
                        </STInputBox>

                        <div v-if="p.reducedPrice !== null || enableFinancialSupport">
                            <STInputBox title="Verlaagd tarief*" error-fields="reducedPrice" :error-box="errorBox">
                                <PriceInput :value="p.reducedPrice" :placeholder="formatPrice(p.price)" :required="false" @input="setReducedPrice(priceGroup, index, $event)" />
                            </STInputBox>
                        </div>
                    </div>
                </STListItem>
            </STList>

            <button v-if="!priceGroup.sameMemberOnlyDiscount || priceGroup.prices.length <= 1" type="button" class="button text full" @click="addFamilyPrice(priceGroup)">
                <span class="icon add" />
                <span>Korting voor extra gezinslid</span>
            </button>

            <button v-if="(priceGroup.sameMemberOnlyDiscount || priceGroup.prices.length <= 1) && canRegisterMultipleGroups" type="button" class="button text full" @click="addMultipleDiscount(priceGroup)">
                <span class="icon add" />
                <span>
                    Korting voor meerdere inschrijvingen**
                </span>
            </button>


            <p v-if="enableFinancialSupport" class="style-description-small">
                * Verlaagd tarief voor leden die financiële ondersteuning hebben aangevraagd. Laat leeg indien je die niet wilt gebruiken.
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

        <button type="button" class="button text" @click="addGroup">
            <span class="icon add" />
            <span v-if="prices.length > 0">Andere prijs na bepaalde datum</span>
            <span v-else>Prijs toevoegen</span>
        </button>
    </div>
</template>

<script lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, DateSelection, ErrorBox, PriceInput, Radio, RadioGroup, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { Group, GroupPrice, GroupPrices, Organization } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";



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

    get enableFinancialSupport() {
        return (this.patchedOrganization ?? this.$organization).meta.recordsConfiguration.financialSupport !== null
    }

    get canRegisterMultipleGroups() {
        if (!this.group) {
            return true
        }
        const parents = this.group.getParentCategories((this.patchedOrganization ?? this.$organization).meta.categories, false)
        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== 1) {
                return true
            }
        }
        return false
    }

    mounted() {
        // Remove wrongfully added duplicate prices
        const groupPricesWithoutDate = this.prices.filter(p => p.startDate === null)
        if (groupPricesWithoutDate.length >= 2) {
            for (const group of groupPricesWithoutDate.slice(1)) {
                this.removeGroup(group, true)
            }
        } else if (groupPricesWithoutDate.length == 0) {
            // Add default price
            this.addGroup()
        }
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
        const prices = group.prices.map(p => p.clone())
        prices[index].price = price
        patch.addPatch(GroupPrices.patch({ id: group.id, prices }))
        this.addPatch(patch)
    }

    setReducedPrice(group: GroupPrices, index: number, reducedPrice: number | null) {
        const patch = this.getPricesPatch()
        const prices = group.prices.map(p => p.clone())
        prices[index].reducedPrice = reducedPrice
        patch.addPatch(GroupPrices.patch({ id: group.id, prices }))
        this.addPatch(patch)
    }

    setStartDate(group: GroupPrices, startDate: Date) {
        const patch = this.getPricesPatch()
        patch.addPatch(GroupPrices.patch({ id: group.id, startDate }))
        this.addPatch(patch)
    }

    removeGroup(group: GroupPrices, force = false) {
        if (group.startDate === null && !force) {
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
        const parents = this.group.getParentCategories((this.patchedOrganization ?? this.$organization).meta.categories, false)
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
}
</script>
