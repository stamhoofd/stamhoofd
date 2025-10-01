<template>
    <LoadingView v-if="loadingRegisterCode" />
    <form v-else id="signup-general-view" class="st-view" :class="{complete: isComplete}" data-submit-last-field @submit.prevent="goNext">
        <STNavigationBar title="Registreren">
            <BackButton slot="left" @click="onPop" />

            <template #right>
                <button v-if="isComplete" type="button" class="button text selected" @click.prevent="goNext">
                    Volgende
                </button>
            </template>
        </STNavigationBar>
        
        <main class="center small">
            <aside class="style-title-prefix">
                STAP 1 / 2
            </aside>
            <h1>
                Vereniging registreren
            </h1>
            <p>
                Je kan alle functies gratis uitproberen zonder dat je betaalgegevens hoeft in te vullen. <a v-if="validatedRegisterCode" :href="'https://'+ $t('shared.domains.marketing')" target="_blank" class="inline-link">Lees hier meer over Stamhoofd.</a>
            </p>

            <p v-if="validatedRegisterCode && !validatedRegisterCode.customMessage" class="success-box icon gift">
                Je ontvangt {{ formatPrice(validatedRegisterCode.value) }} tegoed van {{ validatedRegisterCode.organizationName }} als je nu registreert
            </p>
            <p v-else-if="validatedRegisterCode" class="success-box icon gift">
                {{ validatedRegisterCode.customMessage }}
            </p>

            <p v-if="reuseRegisterCode" class="warning-box">
                Je probeert een doorverwijzingslink met korting van een andere vereniging te gebruiken, maar je hebt al een vereniging geregistreerd. Een doorverwijzingslink is enkel geldig voor de eerste vereniging die je op Stamhoofd aansluit.
            </p>

            <STErrorsDefault :error-box="errorBox" />


            <STInputBox title="Wat voor vereniging?" error-fields="type" :error-box="errorBox" class="max">
                <div class="illustration-radio-container">
                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="OrganizationType.Sport" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/bike.svg">
                        </figure>
                        <h3>Sport</h3>
                    </label>
                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="OrganizationType.Culture" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/stage.svg">
                        </figure>
                        <h3>Cultuur</h3>
                    </label>

                    
                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="OrganizationType.Youth" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/tent.svg">
                        </figure>
                        <h3>Jeugd</h3>
                    </label>
                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="OrganizationType.School" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/education.svg">
                        </figure>
                        <h3>School</h3>
                    </label>
                    
                   
                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="OrganizationType.GoodCause" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/charity.svg">
                        </figure>
                        <h3>Goed doel</h3>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="OrganizationType.Other" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/team.svg">
                        </figure>
                        <h3>Andere</h3>
                    </label>
                </div>
            </STInputBox>

            <STInputBox class="max" title="Naam vereniging of organisatie" error-fields="name" :error-box="errorBox">
                <input
                    id="organization-name"
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="bv. Scouts De Vliegende Hollander"
                    autocomplete="off"
                    enterkeyhint="next"
                >
            </STInputBox>

            <AddressInput v-model="address" enterkeyhint="done" :city-only="true" class="max" title="Locatie" :validator="validator" :link-country-to-locale="true" />
            <p class="style-description-small">
                Je locatie maakt je vereniging makkelijker vindbaar als je de volgende keer wilt inloggen. Je kan het later nog wijzigen.
            </p>

            <template v-if="!validatedRegisterCode">
                <hr>
                <h2>Hoe ken je Stamhoofd? (optioneel)</h2>

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
            </template>
        </main>

        <STToolbar :sticky="isComplete" class="center">
            <LoadingButton slot="right" :loading="loading" class="max">
                <button class="button primary" @click.prevent="goNext">
                    <span>Volgende</span>
                    <span class="icon arrow-right" />
                </button>
            </LoadingButton>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, Dropdown,ErrorBox, LoadingButton, LoadingView,Logo,Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { Radio } from '@stamhoofd/components';
import { PasswordStrength } from '@stamhoofd/components';
import { EmailInput } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager, Storage, UrlHelper } from '@stamhoofd/networking';
import { AcquisitionType, Address, Country, Organization, OrganizationMetaData, OrganizationPrivateMetaData, OrganizationType, OrganizationTypeHelper, RecordConfigurationFactory, RegisterCode, UmbrellaOrganization, UmbrellaOrganizationHelper } from "@stamhoofd/structures";
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import SignupAccountView from './SignupAccountView.vue';
import { usePostHog } from './usePostHog';

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
        Dropdown,
        LoadingView,
        Logo,
        Radio,
        PasswordStrength,
        EmailInput
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

    validatedRegisterCode: null|RegisterCode = null;

    reuseRegisterCode = false;


    loading = false
    loadingRegisterCode = true;

    // Make reactive
    I18nController = I18nController.shared

    type: OrganizationType | null = null
    OrganizationType = OrganizationType;
    umbrellaOrganization: UmbrellaOrganization | null = null

    password = ""
    passwordRepeat = ""
    email = ""
    firstName = ""
    lastName = ""

    acceptPrivacy = false
    acceptTerms = false
    acceptDataAgreement = false

    checkedName = ""
    checkingName = false
    checkCount = 0;
    checkedNameExists = false // true when exists

    async checkName() {
        if (this.name.length === 0) {
            this.checkedName = ""
            this.checkingName = false
            return false;
        }
        this.checkingName = true;

        const uri = Formatter.slug(this.name)

        if (uri.length > 100) {
            this.checkedName = ""

            throw new SimpleError({
                code: "invalid_field",
                message: "",
                human: "De naam van jouw vereniging is te lang. Probeer de naam wat te verkorten en probeer opnieuw.",
                field: "name"
            })
        }

        this.checkCount++;
        const c = this.checkCount;
        const name = this.name

        try {
            Request.cancelAll(this);
            const response = await NetworkManager.server.request({
                method: "GET",
                path: "/organization-from-domain",
                query: {
                    domain: uri + "." + STAMHOOFD.domains.registration['']
                },
                owner: this,
                shouldRetry: true
            })
            if (this.checkCount !== c || this.name !== name) {
                // Discard
                return;
            }
            this.checkedName = name
            this.checkingName = false
            this.checkedNameExists = true
            return true;
        } catch (e) {
            if (this.checkCount !== c || this.name !== name) {
                // Discard
                return;
            }
            this.checkingName = false
            if (isSimpleError(e) || isSimpleErrors(e)) {
                if (e.hasCode("unknown_organization")) {
                    this.checkedName = name
                    this.checkedNameExists = false
                    return false;
                }
            }
            throw e;
        }
    }

    mounted() {
        UrlHelper.setUrl("/aansluiten")   
        usePostHog();
        this.loadRegisterCode().catch(e => {
            console.error(e)
        })

        this.$el.querySelectorAll("input, textarea, select").forEach(el => {
            el.addEventListener("focus", () => {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: "smooth", block: "center", inline: 'start' });
                }, 300); // wait for keyboard animation
            });
        });
    }

    get isComplete() {
        return this.name.length > 2 && this.address != null && this.type != null && this.address.city.length >= 3
    }

    formatPrice(p: number) {
        return Formatter.price(p)
    }

    onPop() {
        if (this.canPop) {
            this.pop();
        }
        if (this.canDismiss) {
            this.dismiss();
        }
        // Go back using the history API
        else if (window.history.length > 1) {
            window.history.back();
        }
        else {
            // Go to marketing site
            window.location.href = 'https://'+this.$t('shared.domains.marketing')+'';
        }
    }

    async loadRegisterCode() {
        this.loadingRegisterCode = true;

        if (this.initialRegisterCode) {
            try {
                await Storage.keyValue.setItem("savedRegisterCode", JSON.stringify(this.initialRegisterCode))
                await Storage.keyValue.setItem("savedRegisterCodeDate", new Date().getTime()+"")
            } catch (e) {
                console.error(e)
            }
            //UrlHelper.setUrl("/aansluiten/?code="+encodeURIComponent(this.initialRegisterCode.code)+"&org="+encodeURIComponent(this.initialRegisterCode.organization))
        }
        try {
            const currentCount = await Storage.keyValue.getItem("what-is-new")
            const saved = await Storage.keyValue.getItem("savedRegisterCode")
            const dString = await Storage.keyValue.getItem("savedRegisterCodeDate")
            
            if (saved !== null && dString !== null) {
                const d = parseInt(dString)
                if (!isNaN(d) && d > new Date().getTime() - 24 * 60 * 60 * 1000) {
                    const parsed = JSON.parse(saved)
                    if (parsed.code && parsed.organization) {
                        if (currentCount === null) {
                            this.registerCode = JSON.parse(saved)
                        } else {
                            this.reuseRegisterCode = true
                            this.registerCode = null
                        }
                    }
                } else {
                    // Expired or invalid
                    await Storage.keyValue.removeItem("savedRegisterCode")
                    await Storage.keyValue.removeItem("savedRegisterCodeDate")
                    this.registerCode = null
                }
            } else {
                await Storage.keyValue.removeItem("savedRegisterCode")
                await Storage.keyValue.removeItem("savedRegisterCodeDate")
                this.registerCode = null
            }
        } catch (e) {
            console.error(e)
        }

        if (this.registerCode) {
            try {
                await this.validateCode()
            } catch (e) {
                this.errorBox = new ErrorBox(e)
                this.registerCode = null
                await Storage.keyValue.removeItem("savedRegisterCode")
                await Storage.keyValue.removeItem("savedRegisterCodeDate")
            }
        }
        this.loadingRegisterCode = false;
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
                const response = await NetworkManager.server.request({
                    method: "GET",
                    path: "/register-code/"+encodeURIComponent(this.registerCode.code.toUpperCase()),
                    decoder: RegisterCode as Decoder<RegisterCode>
                })
                this.validatedRegisterCode = response.data
                this.acquisitionTypes = [AcquisitionType.Recommended]
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

            this.loading = true;
            this.errorBox = null

            const check = await this.checkName();
            if (check === true || check === undefined) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "",
                    human: "Er bestaat al een vereniging met deze naam. Probeer de naam wat te wijzigen (mogelijks bestaan er meerdere verenigingen met dezelfde naam) of kijk na of jouw vereniging niet al is geregistreerd.",
                    field: "name"
                })
            }

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
                address: this.address
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

        // Move 'overige' to the end
        const otherIndex = keys.indexOf("Overige")
        if (otherIndex !== -1) {
            keys.push(keys.splice(otherIndex, 1)[0])
        }

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