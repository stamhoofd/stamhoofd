<template>
    <form id="signup-general-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Nieuwe vereniging">
            <button slot="right" type="button" class="button icon close gray" @click="pop" />
        </STNavigationBar>
        
        <main>
            <h1>
                Nieuwe vereniging aansluiten bij Stamhoofd
            </h1>
            <p>
                Je kan alle functies gratis uitproberen zonder dat je betaalgegevens hoeft in te vullen.
            </p>
            <button v-if="visitViaUrl" class="info-box with-button selectable" type="button" @click="dismiss">
                Gebruikt jouw vereniging Stamhoofd al? 
                <span class="button text" type="button">
                    Log dan hier in
                </span>
            </button>

            <p v-if="registerCode" class="success-box icon gift">
                Je ontvangt 25 euro tegoed van <strong>{{ registerCode.organization }}</strong> als je nu registreert
            </p>

            <STErrorsDefault :error-box="errorBox" />
            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam van jouw vereniging" error-fields="name" :error-box="errorBox">
                        <input
                            id="organization-name"
                            ref="firstInput"
                            v-model="name"
                            class="input"
                            type="text"
                            placeholder="De naam van je vereniging"
                            autocomplete="organization"
                        >
                    </STInputBox>

                    <AddressInput v-model="address" title="Adres van je vereniging" :validator="validator" :link-country-to-locale="true" />
                    <p class="style-description-small">
                        Geen adres? Vul dan een adres in dat in de buurt ligt
                    </p>
                </div>

                <div>
                    <STInputBox title="Type vereniging" error-fields="type" :error-box="errorBox">
                        <Dropdown v-model="type">
                            <option :value="null" disabled>
                                Maak een keuze
                            </option>

                            <optgroup v-for="group in availableTypes" :key="group.name" :label="group.name">
                                <option v-for="_type in group.types" :key="_type.value" :value="_type.value">
                                    {{ _type.name }}
                                </option>
                            </optgroup>
                        </Dropdown>
                    </STInputBox>
                    <p class="style-description-small">
                        Hiermee stellen we automatisch al enkele instellingen goed in.
                    </p>

                    <STInputBox v-if="type == 'Youth' && isBelgium" title="Koepelorganisatie" error-fields="umbrellaOrganization" :error-box="errorBox">
                        <Dropdown v-model="umbrellaOrganization">
                            <option :value="null" disabled>
                                Maak een keuze
                            </option>
                            <option v-for="item in availableUmbrellaOrganizations" :key="item.value" :value="item.value">
                                {{ item.name }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </div>
            </div>

            <hr>
            <h2>Hoe ken je Stamhoofd?</h2>

            <Checkbox :checked="getBooleanType(AcquisitionType.Recommended)" @change="setBooleanType(AcquisitionType.Recommended, $event)">
                Op aanraden van andere vereniging / persoon
            </Checkbox>
            <Checkbox :checked="getBooleanType(AcquisitionType.Seen)" @change="setBooleanType(AcquisitionType.Seen, $event)">
                Gezien bij andere vereniging
            </Checkbox>
            <Checkbox :checked="getBooleanType(AcquisitionType.SocialMedia)" @change="setBooleanType(AcquisitionType.SocialMedia, $event)">
                Via sociale media
            </Checkbox>
            <Checkbox :checked="getBooleanType(AcquisitionType.Search)" @change="setBooleanType(AcquisitionType.Search, $event)">
                Via opzoekwerk (bv. Google)
            </Checkbox>
            <Checkbox :checked="getBooleanType(AcquisitionType.Other)" @change="setBooleanType(AcquisitionType.Other, $event)">
                Andere
            </Checkbox>
        </main>

        <STToolbar :sticky="false">
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" @click.prevent="goNext">
                        Vereniging aanmaken
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, Dropdown,ErrorBox, LoadingButton, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager, UrlHelper } from '@stamhoofd/networking';
import { AcquisitionType, Address, Country, FBId, Organization, OrganizationMetaData, OrganizationPrivateMetaData, OrganizationType, OrganizationTypeHelper, RecordConfigurationFactory, UmbrellaOrganization, UmbrellaOrganizationHelper } from "@stamhoofd/structures";
import { Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FacebookHelper } from '../../classes/FacebookHelper';
import SignupAccountView from './SignupAccountView.vue';


@Component({
    components: {
        STToolbar,
        STNavigationBar,
        Slider,
        STErrorsDefault,
        STInputBox,
        BackButton,
        AddressInput,
        LoadingButton,
        Checkbox,
        Dropdown
    },
    metaInfo() {
        return {
            title: "Sluit jouw vereniging aan | Stamhoofd",
            meta: [
                {
                    vmid: 'description',
                    name: 'description',
                    content: "Maak een gratis account aan om alles van Stamhoofd uit te proberen. Geheel zonder verplichtingen.",
                }
            ]
        }
    }
})
export default class SignupGeneralView extends Mixins(NavigationMixin) {
    name = ""
    validator = new Validator()
    errorBox: ErrorBox | null = null
    address: Address | null = null
    acquisitionTypes: AcquisitionType[] = []

    @Prop({ default: false})
    visitViaUrl!: boolean

    @Prop({ default: null })
    initialRegisterCode!: { code: string; organization: string } | null;

    registerCode = this.initialRegisterCode
    loading = false

    // Make reactive
    I18nController = I18nController.shared

    type: OrganizationType | null = null
    umbrellaOrganization: UmbrellaOrganization | null = null

    mounted() {
        if (this.initialRegisterCode) {
            try {
                localStorage.setItem("savedRegisterCode", JSON.stringify(this.initialRegisterCode))
                localStorage.setItem("savedRegisterCodeDate", new Date().getTime()+"")
            } catch (e) {
                console.error(e)
            }
            //UrlHelper.setUrl("/aansluiten/?code="+encodeURIComponent(this.initialRegisterCode.code)+"&org="+encodeURIComponent(this.initialRegisterCode.organization))
        }
        UrlHelper.setUrl("/aansluiten")   

        if (!this.initialRegisterCode) {
            try {
                const currentCount = localStorage.getItem("what-is-new")
                const saved = localStorage.getItem("savedRegisterCode")
                const dString = localStorage.getItem("savedRegisterCodeDate")
                if (currentCount === null && saved !== null && dString !== null) {
                    const d = parseInt(dString)
                    if (!isNaN(d) && d > new Date().getTime() - 24 * 60 * 60 * 1000) {
                        const parsed = JSON.parse(saved)
                        if (parsed.code && parsed.organization) {
                            this.registerCode = JSON.parse(saved)
                        }
                    } else {
                        // Expired or invalid
                        localStorage.removeItem("savedRegisterCode")
                        localStorage.removeItem("savedRegisterCodeDate")
                    }
                } else {
                    localStorage.removeItem("savedRegisterCode")
                    localStorage.removeItem("savedRegisterCodeDate")
                }
            } catch (e) {
                console.error(e)
            }
        }

        if (this.registerCode) {
            this.validateCode().catch(e => {
                this.errorBox = new ErrorBox(e)
                this.registerCode = null
                localStorage.removeItem("savedRegisterCode")
                localStorage.removeItem("savedRegisterCodeDate")
            })
        }

        this.sendId().catch(console.error)

    }

    get isBelgium() {
        return I18nController.shared.country === Country.Belgium && (!this.address  || this.address.country === Country.Belgium)
    }

    get AcquisitionType() {
        return AcquisitionType
    }

    async validateCode() {
        // Check register code
        if (this.registerCode) {
            try {
                await NetworkManager.server.request({
                    method: "GET",
                    path: "/register-code/"+encodeURIComponent(this.registerCode.code.toUpperCase()),
                })
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    if (e.hasCode("invalid_code")) {
                        throw new SimpleError({
                            code: "invalid_code",
                            message: "De gebruikte doorverwijzingslink is niet meer geldig. Je kan verder met registereren, maar je ontvangt geen tegoed.",
                            field: "registerCode"
                        })
                    }
                }
                throw e
            }
        }
    }

    async sendId() {
        // Check register code
        const id = FacebookHelper.id
        if (id) {
            try {
                await NetworkManager.server.request({
                    method: "POST",
                    path: "/organizations/open",
                    body: id
                })
            } catch (e) {
                console.error(e)
            }
        }
    }

    async goNext() {
        if (this.loading) {
            return
        }
        
        try {
            if (this.name.length == 0) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "",
                    human: "Vul de naam van jouw vereniging in",
                    field: "name"
                })
            }
            if (this.name.length < 4) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "",
                    human: "De naam van jouw vereniging is te kort",
                    field: "name"
                })
            }

            if (this.type === null) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Maak een keuze",
                    field: "type"
                })
            }

            if (this.type == OrganizationType.Youth && this.isBelgium) {
                if (this.umbrellaOrganization === null) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Maak een keuze",
                        field: "umbrellaOrganization"
                    })
                }
            } else {
                this.umbrellaOrganization = null
            }

            this.loading = true;
            this.errorBox = null

            if (!await this.validator.validate() || !this.address) {
                this.loading = false;
                return
            }

            // Check register code
            try {
                await this.validateCode()
            } catch (e) {
                this.errorBox = new ErrorBox(e)
                this.loading = false;
                return;
            }

            const defaultStartDate = new Date()
            defaultStartDate.setMonth(defaultStartDate.getMonth() + 1)
            defaultStartDate.setDate(1)

            const defaultEndDate = new Date(defaultStartDate.getTime())
            defaultEndDate.setFullYear(defaultStartDate.getFullYear() + 1)

            const organization = Organization.create({
                name: this.name,
                uri: "", // ignored by backend for now
                meta: OrganizationMetaData.create({
                    type: this.type,
                    umbrellaOrganization: this.umbrellaOrganization,
                    recordsConfiguration: RecordConfigurationFactory.create(this.type, this.address.country),
                    defaultStartDate,
                    defaultEndDate
                }),
                privateMeta: OrganizationPrivateMetaData.create({
                    acquisitionTypes: this.acquisitionTypes
                }),
                address: this.address,
                publicKey: "" // placeholder
            })

            this.loading = false;
            this.errorBox = null
            this.show(new ComponentWithProperties(SignupAccountView, { organization, registerCode: this.registerCode }))
            plausible('signupGeneral');
        } catch (e) {
            this.loading = false;
            console.error(e)
            this.errorBox = new ErrorBox(e)
            plausible('signupGeneralError');
            return;
        }
    }

    get availableTypes() {
        const types = OrganizationTypeHelper.getList().sort((a, b) => 
            Sorter.stack(
                Sorter.byBooleanValue(
                    !a.name.toLowerCase().startsWith("andere"), 
                    !b.name.toLowerCase().startsWith("andere")
                ), 
                Sorter.byStringProperty(a, b, "name")
            )
        );

        // Group by category
        const map = new Map<string, {
            value: OrganizationType;
            name: string;
        }[]>()

        for (const type of types) {
            const cat = OrganizationTypeHelper.getCategory(type.value)
            if (!map.has(cat)) {
                map.set(cat, [type])
            } else {
                map.get(cat)!.push(type)
            }
        }

        const keys = Array.from(map.keys()).sort(Sorter.byStringValue)

        return keys.map((key) => {
            const types = map.get(key)!
            return {
                name: key,
                types
            }
        })
    }

    get availableUmbrellaOrganizations() {
        return UmbrellaOrganizationHelper.getList().sort((a, b) => 
            Sorter.stack(
                Sorter.byBooleanValue(
                    !a.name.toLowerCase().startsWith("andere"), 
                    !b.name.toLowerCase().startsWith("andere")
                ), 
                Sorter.byStringProperty(a, b, "name")
            )
        )
    }

    async shouldNavigateAway() {
        if (this.name == "" && this.address == null && this.type == null) {
            return true
        }
        if (await CenteredMessage.confirm("Ben je zeker dat je dit venster wilt sluiten?", "Sluiten")) {
            plausible('closeSignup');
            return true;
        }
        plausible('cancelCloseSignup');
        return false;
    }

    // Helpers ---

    getBooleanType(type: AcquisitionType) {
        return !!this.acquisitionTypes.find(r => r == type)
    }

    setBooleanType(type: AcquisitionType, enabled: boolean) {
        const index = this.acquisitionTypes.findIndex(r => r == type)
        if ((index != -1) === enabled) {
            return
        }
        
        if (enabled) {
            this.acquisitionTypes.push(type)
        } else {
            this.acquisitionTypes.splice(index, 1)
        }
    }
}
</script>