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

                    <STInputBox title="Inschrijven sluit op" error-fields="settings.endDate" :error-box="errorBox">
                        <DateSelection v-model="endDate" />
                    </STInputBox>
                </div>

                <div class="split-inputs">
                    <STInputBox title="Minimum leeftijd* (optioneel)" error-fields="settings.minAge" :error-box="errorBox">
                        <AgeInput v-model="minAge" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>

                    <STInputBox title="Maximum leeftijd* (optioneel)" error-fields="settings.maxAge" :error-box="errorBox">
                        <AgeInput v-model="maxAge" placeholder="Onbeperkt" :nullable="true" />
                    </STInputBox>
                </div>
                <p class="st-list-description">
                    *De leeftijd die het lid zal worden in het jaar waarin de inschrijvingen starten.
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
                <STInputBox title="Lidgeld" error-fields="price" :error-box="errorBox">
                    <PriceInput v-model="price" placeholder="Gratis" />
                </STInputBox>

                <Checkbox v-model="enableReducedPrice">
                    Verminder het lidgeld voor leden met financiële moeilijkheden
                </Checkbox>

                <STInputBox v-if="enableReducedPrice" title="Verminderd lidgeld" error-fields="reducedPrice" :error-box="errorBox">
                    <PriceInput v-model="reducedPrice" placeholder="Gratis" />
                </STInputBox>

                <Checkbox v-model="enableLatePrice">
                    Verminder het lidgeld na een bepaalde datum
                </Checkbox>

                <div v-if="enableLatePrice" class="split-inputs">
                    <STInputBox title="Verminder het lidgeld vanaf" error-fields="reducedPriceDate" :error-box="errorBox">
                        <DateSelection v-model="latePriceDate" />
                    </STInputBox>

                    <STInputBox title="Lidgeld na deze datum" error-fields="reducedPriceDate" :error-box="errorBox">
                        <PriceInput v-model="latePrice" placeholder="Gratis" />
                    </STInputBox>
                </div>

                <STInputBox v-if="enableLatePrice && enableReducedPrice" title="Verminderd lidgeld na deze datum" error-fields="reducedLatePrice" :error-box="errorBox">
                    <PriceInput v-model="reducedLatePrice" placeholder="Gratis" />
                </STInputBox>

                <STErrorsDefault :error-box="errorBox" />
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
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AgeInput, DateSelection, ErrorBox, FemaleIcon, MaleIcon, Radio, RadioGroup, SegmentedControl, Spinner,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, PriceInput, Checkbox } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, GroupPrices } from "@stamhoofd/structures"
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
        Spinner
    },
})
export default class EditGroupView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null

    tabs = ["general", "payments"];
    tab = this.tabs[0];
    tabLabels = ["Algemeen", "Lidgeld"];

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
                patch.addPut(GroupPrices.create({ startDate: new Date() }))
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

    async save() {
        this.saving = true

        await OrganizationManager.patch(this.organizationPatch)
        this.saving = false
        this.pop({ force: true })
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.group-edit-view {

}
</style>
