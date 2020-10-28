<template>
    <div class="st-view group-edit-view">
        <STNavigationBar :title="isNew ? 'Nieuwe groep toevoegen' : name+' bewerken'">
            <button slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Nieuwe groep toevoegen
            </h1>
            <h1 v-else>
                {{ name }} bewerken
            </h1>
            <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />

            <template v-if="tab == 'general'">
                <STErrorsDefault :error-box="errorBox" />
                <STInputBox title="Naam" error-fields="settings.name" :error-box="errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="Naam van deze groep"
                        autocomplete=""
                    >
                </STInputBox>

                <STInputBox title="Beschrijving" error-fields="settings.description" :error-box="errorBox" class="max">
                    <textarea
                        v-model="description"
                        class="input"
                        type="text"
                        placeholder="Zichtbaar voor leden tijdens het inschrijven"
                        autocomplete=""
                    />
                </STInputBox>

                <div class="split-inputs">
                    <STInputBox title="Inschrijven start op" error-fields="settings.startDate" :error-box="errorBox">
                        <DateSelection v-model="startDate" />
                    </STInputBox>
                    <TimeInput v-model="startDate" title="Vanaf" :validator="validator" /> 
                </div>
                

                <div class="split-inputs">
                    <STInputBox title="Inschrijven sluit op" error-fields="settings.endDate" :error-box="errorBox">
                        <DateSelection v-model="endDate" />
                    </STInputBox>
                    <TimeInput v-model="endDate" title="Tot welk tijdstip" :validator="validator" />
                </div>
                <p class="st-list-description">
                    Als de inschrijvingen het hele jaar doorlopen, vul dan hier gewoon een datum in ergens op het einde van het jaar. Let op het jaartal.
                </p>
      
                <div class="split-inputs">
                    <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="settings.minAge" :error-box="errorBox">
                        <AgeInput v-model="minAge" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>

                    <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="settings.maxAge" :error-box="errorBox">
                        <AgeInput v-model="maxAge" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>
                </div>
                <p class="st-list-description">
                    *De leeftijd die het lid zal worden in het jaar waarin de inschrijvingen starten. Ter referentie: leden uit het eerste leerjaar worden 6 jaar in september. Leden uit het eerste secundair worden 12 jaar in september.
                </p>

                <STInputBox title="Jongens en meisjes" error-fields="genderType" :error-box="errorBox" class="max">
                    <RadioGroup>
                        <Radio v-for="_genderType in genderTypes" :key="_genderType.value" v-model="genderType" :value="_genderType.value">
                            {{ _genderType.name }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>
            </template>
            <template v-if="tab == 'payments'">
                <STInputBox title="Standaard tarief" error-fields="price" :error-box="errorBox">
                    <PriceInput v-model="price" placeholder="Gratis" />
                </STInputBox>

                <Checkbox v-model="enableReducedPrice">
                    Verlaagd tarief voor leden met financiële moeilijkheden
                </Checkbox>
                <STInputBox v-if="enableReducedPrice" title="Verlaagd tarief" error-fields="reducedPrice" :error-box="errorBox">
                    <PriceInput v-model="reducedPrice" placeholder="Gratis" />
                </STInputBox>
               
                <Checkbox v-model="enableLatePrice">
                    Verlaagd tarief na een bepaalde datum
                </Checkbox>

                <div v-if="enableLatePrice" class="split-inputs">
                    <STInputBox title="Verminder het lidgeld vanaf" error-fields="reducedPriceDate" :error-box="errorBox">
                        <DateSelection v-model="latePriceDate" />
                    </STInputBox>

                    <STInputBox title="Standaard tarief na deze datum" error-fields="reducedPriceDate" :error-box="errorBox">
                        <PriceInput v-model="latePrice" placeholder="Gratis" />
                    </STInputBox>
                </div>

                <STInputBox v-if="enableLatePrice && enableReducedPrice" title="Verlaagd tarief na deze datum" error-fields="reducedLatePrice" :error-box="errorBox">
                    <PriceInput v-model="reducedLatePrice" placeholder="Gratis" />
                </STInputBox>

                <Checkbox v-model="enableFamilyPrice">
                    Verlaagd tarief voor broers/zussen
                </Checkbox>
                <div v-if="enableFamilyPrice" class="split-inputs">
                    <STInputBox title="Voor tweede broer/zus" error-fields="reducedPrice" :error-box="errorBox">
                        <PriceInput v-model="familyPrice" placeholder="Gratis" />
                    </STInputBox>
                    <STInputBox title="Daaropvolgende broers/zussen" error-fields="reducedPrice" :error-box="errorBox">
                        <PriceInput v-model="extraFamilyPrice" placeholder="Gratis" />
                    </STInputBox>
                </div>
                <p v-if="enableFamilyPrice" class="style-description">
                    Als meerdere verlaagde tarieven van toepassing zijn wordt automatisch het laagste gekozen.
                </p>

                <STErrorsDefault :error-box="errorBox" />
            </template>

            <template v-if="tab == 'queue'">
                <STInputBox title="Wachtlijst" error-fields="genderType" :error-box="errorBox" class="max">
                    <RadioGroup class="column">
                        <Radio v-model="waitingListType" value="None">
                            Geen wachtlijst
                        </Radio>
                        <Radio v-model="waitingListType" value="PreRegistrations">
                            Voorinschrijvingen <span class="radio-description">Bestaande leden kunnen al vroeger beginnen met inschrijven. Bij het openen van de inschrijvingen kan men blijven inschrijven tot het maximaal aantal leden bereikt is. Daarna sluiten de inschrijvingen.</span>
                        </Radio>
                        <Radio v-model="waitingListType" value="ExistingMembersFirst">
                            Alle nieuwe leden op wachtlijst<span class="radio-description">Bestaande leden kunnen meteen inschrijven. Van de nieuwe leden kies je zelf wie je doorlaat.</span>
                        </Radio>
                        <Radio v-model="waitingListType" value="All">
                            Iedereen op wachtlijst <span class="radio-description">Iedereen moet manueel worden goedgekeurd.</span>
                        </Radio>
                    </RadioGroup>
                </STInputBox>
               
                <STInputBox v-if="waitingListType != 'None'" title="Maximaal aantal ingeschreven leden">
                    <Slider v-model="maxMembers" :max="200" />
                </STInputBox>

                <div v-if="waitingListType == 'PreRegistrations'" class="split-inputs">
                    <STInputBox v-if="waitingListType == 'PreRegistrations'" title="Begindatum voorinschrijvingen" error-fields="settings.preRegistrationsDate" :error-box="errorBox">
                        <DateSelection v-model="preRegistrationsDate" />
                    </STInputBox>
                    
                    <TimeInput v-model="preRegistrationsDate" title="Vanaf" :validator="validator" /> 
                </div>
                <Checkbox v-if="waitingListType == 'PreRegistrations' || waitingListType == 'ExistingMembersFirst'" v-model="priorityForFamily">
                    Naast bestaande leden ook voorrang geven aan broers/zussen
                </Checkbox>
            </template>
        </main>

        <STToolbar>
            <template slot="right">
                <Spinner v-if="saving" />
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AgeInput, Checkbox, DateSelection, ErrorBox, FemaleIcon, MaleIcon, PriceInput, Radio, RadioGroup, SegmentedControl, Slider, Spinner,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { Group, GroupGenderType, GroupPatch, GroupPrices, GroupSettings, GroupSettingsPatch, Organization, WaitingListType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        MaleIcon,
        FemaleIcon,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        AgeInput,
        Slider,
        Spinner,
        TimeInput
    },
})
export default class EditGroupView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    tabs = ["general", "payments", "queue"];
    tab = this.tabs[0];
    tabLabels = ["Algemeen", "Lidgeld", "Wachtlijst"];

    saving = false

    @Prop()
    groupId!: string;

    @Prop()
    organizationPatch!: AutoEncoderPatchType<Organization> & AutoEncoder ;

    get isNew() {
        return this.organizationPatch.groups.getPuts().length > 0
    }

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get group() {
        const organization = this.organization
        for (const group of organization.groups) {
            if (group.id === this.groupId) {
                return group
            }
        }
        throw new Error("Group not found")
    }

    addPatch(patch: AutoEncoderPatchType<Group> ) {
        if (this.saving) {
            return
        }
        (this.organizationPatch as any).groups.addPatch(patch)
    }

    getPricesPatch(): PatchableArrayAutoEncoder<GroupPrices> {
        return new PatchableArray()
    }

    addSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupSettings>> ) {
        this.addPatch(GroupPatch.create({ 
            id: this.groupId, 
            settings: GroupSettingsPatch.create(patch)
        }))
    }

    get name() {
        return this.group.settings.name
    }

    set name(name: string) {
        this.addSettingsPatch({ name })
    }

    get description() {
        return this.group.settings.description
    }

    set description(description: string) {
        this.addSettingsPatch({ description })
    }

    get startDate() {
        return this.group.settings.startDate
    }

    set startDate(startDate: Date) {
        this.addSettingsPatch({ startDate })
    }

    get endDate() {
        return this.group.settings.endDate
    }

    set endDate(endDate: Date) {
        this.addSettingsPatch({ endDate })
    }

    get genderType() {
        return this.group.settings.genderType
    }

    set genderType(genderType: GroupGenderType) {
        this.addSettingsPatch({ genderType })
    }

    // Birth years
    get minAge() {
        return this.group.settings.minAge
    }

    set minAge(minAge: number | null) {
        this.addSettingsPatch({ minAge })
    }

    get maxAge() {
        return this.group.settings.maxAge
    }
    
    set maxAge(maxAge: number | null) {
        this.addSettingsPatch({ maxAge })
    }

    get genderTypes() {
        return [
            {
                value: GroupGenderType.Mixed,
                name: "Gemengd",
            },
            {
                value: GroupGenderType.OnlyFemale,
                name: "Enkel meisjes",
            },
            {
                value: GroupGenderType.OnlyMale,
                name: "Enkel jongens",
            },
        ]
    }

    get price() {
        return this.group.settings.prices.find(p => p.startDate == null)?.price ?? 0
    }

    set price(price: number) {
        const p = this.group.settings.prices.find(p => p.startDate == null)

        if (!p) {
            const patch = this.getPricesPatch()
            patch.addPut(GroupPrices.create({ price }))
            this.addSettingsPatch({ prices: patch })
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, price }))
            this.addSettingsPatch({ prices: patch })
        }
    }

    get enableReducedPrice() {
        return !!this.group.settings.prices.find(p => p.reducedPrice !== null)
    }

    set enableReducedPrice(enable: boolean) {
        const patch = this.getPricesPatch()

        for (const price of this.group.settings.prices) {
            if (!enable) {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, reducedPrice: null}))
            } else {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, reducedPrice: price.price}))
            }
        }

        this.addSettingsPatch({ prices: patch })
    }

    get enableFamilyPrice() {
        return !!this.group.settings.prices.find(p => p.familyPrice !== null)
    }

    set enableFamilyPrice(enable: boolean) {
        const patch = this.getPricesPatch()

        for (const price of this.group.settings.prices) {
            if (!enable) {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice: null, extraFamilyPrice: null }))
            } else {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice: price.price, extraFamilyPrice: price.price }))
            }
        }

        this.addSettingsPatch({ prices: patch })
    }

    get familyPrice() {
        return this.group.settings.prices.find(p => p.startDate == null)?.familyPrice ?? 0
    }

    set familyPrice(familyPrice: number) {
        const patch = this.getPricesPatch()

        for (const price of this.group.settings.prices) {
            patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice }))
        }

        this.addSettingsPatch({ prices: patch })
    }

    get extraFamilyPrice() {
        return this.group.settings.prices.find(p => p.startDate == null)?.extraFamilyPrice ?? 0
    }

    set extraFamilyPrice(extraFamilyPrice: number) {
        const patch = this.getPricesPatch()

        for (const price of this.group.settings.prices) {
            patch.addPatch(GroupPrices.patchType().create({ id: price.id, extraFamilyPrice }))
        }

        this.addSettingsPatch({ prices: patch })
    }

    get reducedPrice() {
        return this.group.settings.prices.find(p => p.startDate == null)?.reducedPrice ?? 0
    }

    set reducedPrice(reducedPrice: number) {
        const p = this.group.settings.prices.find(p => p.startDate == null)

        if (!p) {
            const patch = this.getPricesPatch()
            patch.addPut(GroupPrices.create({ reducedPrice }))
            this.addSettingsPatch({ prices: patch })
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, reducedPrice }))
            this.addSettingsPatch({ prices: patch })
        }
    }

    get enableLatePrice() {
        return !!this.group.settings.prices.find(p => p.startDate !== null)
    }

    set enableLatePrice(enable: boolean) {
        const p = this.group.settings.prices.find(p => p.startDate !== null)

        if (!enable) {
            if (p) {
                const patch = this.getPricesPatch()
                patch.addDelete(p.id)
                this.addSettingsPatch({ prices: patch })
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
                this.addSettingsPatch({ prices: patch })
            }
        }
    }

    get latePrice() {
        return this.group.settings.prices.find(p => p.startDate !== null)?.price ?? 0
    }

    set latePrice(price: number) {
        const p = this.group.settings.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, price }))
            this.addSettingsPatch({ prices: patch })
        }
    }

    get reducedLatePrice() {
        return this.group.settings.prices.find(p => p.startDate !== null)?.reducedPrice ?? 0
    }

    set reducedLatePrice(reducedPrice: number) {
        const p = this.group.settings.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, reducedPrice }))
            this.addSettingsPatch({ prices: patch })
        }
    }

    get latePriceDate() {
        return this.group.settings.prices.find(p => p.startDate !== null)?.startDate ?? new Date()
    }

    set latePriceDate(startDate: Date) {
        const p = this.group.settings.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, startDate }))
            this.addSettingsPatch({ prices: patch })
        }
    }

    // Waiting list

    get waitingListType() {
        return this.group.settings.waitingListType
    }

    set waitingListType(waitingListType: WaitingListType) {
        if (waitingListType == WaitingListType.PreRegistrations) {
            const preRegistrationsDate = new Date(this.startDate.getTime())
            preRegistrationsDate.setDate(preRegistrationsDate.getDate() - 14)
            this.addSettingsPatch({ preRegistrationsDate })
        } else {
            this.addSettingsPatch({ preRegistrationsDate: null })
        }
        if (waitingListType != WaitingListType.None) {
            this.addSettingsPatch({ maxMembers: this.maxMembers ?? 50 })
        } else {
            this.addSettingsPatch({ maxMembers: null })
        }
        this.addSettingsPatch({ waitingListType })
    }

    get preRegistrationsDate() {
        return this.group.settings.preRegistrationsDate
    }

    set preRegistrationsDate(preRegistrationsDate: Date | null) {
        this.addSettingsPatch({ preRegistrationsDate })
    }

    get maxMembers() {
        return this.group.settings.maxMembers
    }

    set maxMembers(maxMembers: number | null) {
        this.addSettingsPatch({ maxMembers })
    }

    get priorityForFamily() {
        return this.group.settings.priorityForFamily
    }

    set priorityForFamily(priorityForFamily: boolean) {
        this.addSettingsPatch({ priorityForFamily })
    }

    // Saving

    async save() {
        const valid = await this.validator.validate()

        if (!valid) {
            return;
        }
        this.saving = true

        await OrganizationManager.patch(this.organizationPatch)
        this.saving = false
        this.pop({ force: true })
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-edit-view {
    

}
</style>
