<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Instellingen
            </h1>

            <STList class="illustration-list">    
                <STListItem :selectable="true" @click="openGeneral" class="left-center">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/flag.svg" />
                    <h2 class="style-title-list">Algemeen</h2>
                    <p class="style-description">Naam, adres en website</p>
                    <span class="icon arrow-right-small gray" slot="right"/>
                </STListItem>

                <STListItem :selectable="true" @click="openPersonalize" class="left-center">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/paint.svg" />
                    <h2 class="style-title-list">Personaliseren</h2>
                    <p class="style-description">Logo, kleur en domeinnaam</p>
                    <span class="icon arrow-right-small gray" slot="right"/>
                </STListItem>

                <STListItem :selectable="true" @click="setupEmail" class="left-center">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/email.svg" />
                    <h2 class="style-title-list">E-mailadressen</h2>
                    <p class="style-description">Verstuur e-mails vanaf je zelf gekozen e-mailadres</p>
                    <template slot="right">
                        <span class="icon warning yellow" v-tooltip="'We hebben zeker één e-mailadres nodig voor communicatie en indien leden antwoorden op automatische e-mails'" v-if="!hasPolicy" />
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem :selectable="true" @click="openPrivacy" class="left-center">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/shield.svg" />
                    <h2 class="style-title-list">Privacy</h2>
                    <p class="style-description">Stel je privacyvoorwaarden in</p>
                    <template slot="right">
                        <span class="icon warning yellow" v-tooltip="'Voeg je privacyvoorwaarden toe om in orde te zijn met GDPR'" v-if="!hasPolicy" />
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem :selectable="true" @click="openPayment(true)" class="left-center">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/creditcards.svg" />
                    <h2 class="style-title-list">Betaalmethodes</h2>
                    <p class="style-description">Bankrekeningnummer, Payconiq, Bancontact...</p>
                    <template slot="right">
                        <span class="icon warning yellow" v-tooltip="'Je hebt nog geen bankrekeningnummer toegevoegd of andere betaalmethodes geactiveerd'" v-if="!hasPaymentMethod"/>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>

            <template v-if="enableMemberModule">

                <hr>
                <h2>Inschrijvingen</h2>

                <STList class="illustration-list">    
                    <STListItem :selectable="true" @click="manageGroups" class="left-center right-stack">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/group.svg" />
                        <h2 class="style-title-list">Leeftijdsgroepen</h2>
                        <p class="style-description">Prijzen, leeftijden, wachtlijsten</p>

                        <template slot="right">
                            <span v-if="!hasGroups" class="icon warning yellow" v-tooltip="'Je hebt nog geen leeftijdsgroepen ingesteld'"/>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

            </template>

            <hr>
            <h2>Kies de functies die je wilt activeren</h2>
            <p>We rekenen nooit kosten aan zonder dit duidelijk te communiceren en hiervoor toestemming te vragen.</p>

            <ModuleSettingsBox />
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, PartialWithoutMethods, PatchableArray,patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager,NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STList, STListItem, BackButton, Checkbox, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator, CenteredMessage, TooltipDirective} from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, File, Image, Organization, OrganizationMetaData, OrganizationModules, OrganizationPatch, OrganizationPrivateMetaData,PaymentMethod, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
import EditGroupsView from '../groups/EditGroupsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import DomainSettingsView from './DomainSettingsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
import GeneralSettingsView from './GeneralSettingsView.vue';
import MembersStructureSetupView from './modules/members/MembersStructureSetupView.vue';
import MembersYearSetupView from './modules/members/MembersYearSetupView.vue';
import PaymentSettingsView from './PaymentSettingsView.vue';
import PersonalizeSettingsView from './PersonalizeSettingsView.vue';
import PrivacySettingsView from './PrivacySettingsView.vue';
import ModuleSettingsBox from './ModuleSettingsBox.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        RadioGroup,
        Radio,
        BackButton,
        LoadingButton,
        IBANInput,
        FileInput,
        STList,
        STListItem,
        ModuleSettingsBox
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class SettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization
    showDomainSettings = true
    loadingMollie = false

    get organization() {
        return OrganizationManager.organization
    }

    openGeneral() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(GeneralSettingsView, {})
        }).setDisplayStyle("popup"))
    }

    openPersonalize() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PersonalizeSettingsView, {})
        }).setDisplayStyle("popup"))
    }

    openPrivacy() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PrivacySettingsView, {})
        }).setDisplayStyle("popup"))
    }

    setupEmail() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailSettingsView, {})
        }).setDisplayStyle("popup"))
    }

    openPayment(animated = true) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PaymentSettingsView, {})
        }).setDisplayStyle("popup"))
    }

    manageGroups() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditGroupsView, {})
        }).setDisplayStyle("popup"))
    }

    get hasPolicy() {
        return this.organization.meta.privacyPolicyUrl !== null || this.organization.meta.privacyPolicyFile !== null
    }

    get hasPaymentMethod() {
        return this.organization.meta.iban.length > 0 || !this.organization.meta.paymentMethods.includes(PaymentMethod.Transfer)
    } 

    get hasGroups() {
        return this.organization.groups.length > 0
    } 

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
    }

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        document.title = "Stamhoofd - Instellingen"

        if (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'mollie') {
            // Open mollie settings
            this.openPayment(false)
            return
        }

        // First set current url already, to fix back
        HistoryManager.setUrl("/settings")

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'general') {
            // Open mollie settings
            this.openGeneral()
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'payments') {
            // Open mollie settings
            this.openPayment(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'privacy') {
            // Open mollie settings
            this.openPrivacy()
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'personalize') {
            // Open mollie settings
            this.openPersonalize()
        }


    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#settings-view {
    .illustration-list img {
        @extend .style-illustration-img;
    }
}

</style>
