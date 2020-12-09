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
                <STListItem :selectable="true" @click="openGeneral">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/flag.svg" />
                    <h2 class="style-title-list">Algemeen</h2>
                    <p class="style-description">Naam, adres en website</p>
                    <span class="icon arrow-right-small gray" slot="right"/>
                </STListItem>

                <STListItem :selectable="true" @click="openPersonalize">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/paint.svg" />
                    <h2 class="style-title-list">Personaliseren</h2>
                    <p class="style-description">Logo, kleur en domeinnaam</p>
                    <span class="icon arrow-right-small gray" slot="right"/>
                </STListItem>

                <STListItem :selectable="true" @click="setupEmail">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/email.svg" />
                    <h2 class="style-title-list">E-mailadressen</h2>
                    <p class="style-description">Verstuur e-mails vanaf je zelf gekozen e-mailadres</p>
                    <span class="icon arrow-right-small gray" slot="right"/>
                </STListItem>

                <STListItem :selectable="true" @click="openPrivacy">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/shield.svg" />
                    <h2 class="style-title-list">Privacy</h2>
                    <p class="style-description">Stel je privacyvoorwaarden in</p>
                    <template slot="right">
                        <span class="icon warning yellow" v-tooltip="'Voeg je privacyvoorwaarden toe om in orde te zijn met GDPR'"/>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem :selectable="true" @click="openPayment(true)">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/creditcards.svg" />
                    <h2 class="style-title-list">Betaalmethodes</h2>
                    <p class="style-description">Bankrekeningnummer, Payconiq, Bancontact...</p>
                    <template slot="right">
                        <span class="icon warning yellow" v-tooltip="'Je hebt nog geen bankrekeningnummer toegevoegd of andere betaalmethodes geactiveerd'"/>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>

            <template v-if="enableMemberModule">

                <hr>
                <h2>Inschrijvingen</h2>

                <STList class="illustration-list">    
                    <STListItem :selectable="true" @click="manageGroups" class="right-stack">
                        <img slot="left" src="~@stamhoofd/assets/images/illustrations/group.svg" />
                        <h2 class="style-title-list">Leeftijdsgroepen</h2>
                        <p class="style-description">Prijzen, leeftijden, wachtlijsten</p>

                        <template slot="right">
                            <span class="icon warning yellow" v-tooltip="'Je hebt nog geen leeftijdsgroepen ingesteld'"/>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

            </template>

            <hr>
            <h2>Kies de functies die je wilt activeren</h2>
            <p>We rekenen nooit kosten aan zonder dit duidelijk te communiceren en hiervoor toestemming te vragen.</p>

            <div class="module-box">
                <label :class="{ selected: enableMemberModule }">
                    <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/list.svg" /></div>
                    <div>
                        <h2 class="style-title-list">Inschrijvingen en ledenbeheer</h2>
                        <p class="style-description">Gratis</p>
                    </div>
                    <div>
                        <Checkbox v-model="enableMemberModule" />
                    </div>
                </label>

                <label :class="{ selected: enableWebshopModule }">
                    <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/cart.svg" /></div>
                    <div>
                        <h2 class="style-title-list">Webshops</h2>
                        <p class="style-description">Tijdelijk gratis voor alle shops die je nu aanmaakt</p>
                    </div>
                    <div>
                        <Checkbox v-model="enableWebshopModule" />
                    </div>
                </label>

                <label class="disabled">
                    <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/flag.svg" /></div>
                    <div>
                        <h2 class="style-title-list">Activiteiten</h2>
                        <p class="style-description">Maak activiteiten aan en laat leden inschrijven</p>
                    </div>
                    <div>
                        <span class="style-tag">2021</span>
                    </div>
                </label>

                <label class="disabled">
                    <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/laptop.svg" /></div>
                    <div>
                        <h2 class="style-title-list">Bouw zelf je website</h2>
                        <p class="style-description">Maak een unieke website die je zelf kan aanpassen. Geen technische kennis vereist</p>
                    </div>
                    <div>
                        <span class="style-tag">2021</span>
                    </div>
                </label>

                <label class="disabled">
                    <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/tickets.svg" /></div>
                    <div>
                        <h2 class="style-title-list">Ticketverkoop</h2>
                        <p class="style-description">Verkoop en scan tickets met je smartphone</p>
                    </div>
                    <div>
                        <span class="style-tag">2021</span>
                    </div>
                </label>

                <label class="disabled">
                    <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/house.svg" /></div>
                    <div>
                        <h2 class="style-title-list">Verhuur materiaal en lokalen</h2>
                        <p class="style-description">Online reservaties, automatische contracten en kalenders</p>
                    </div>
                    <div>
                        <span class="style-tag">2021</span>
                    </div>
                </label>
            </div>
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
        STListItem
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

    patchModule(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationModules>>, message: string) {
        OrganizationManager.patch(OrganizationPatch.create({
            id: this.organization.id,
            meta: OrganizationMetaData.patch({
                modules: OrganizationModules.patch(patch)
            })
        })).then(() => {
            new Toast(message, "success green").show()
        }).catch(e => {
            CenteredMessage.fromError(e).show()
        })
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    set enableMemberModule(enable: boolean) {
        if (!enable) {
            this.organization.meta.modules.useMembers = enable
            this.patchModule({ useMembers: enable }, enable ? "De ledenadministratie module is nu actief" : "De ledenadministratie module is nu uitgeschakeld")
        } else {
            this.present(new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(MembersStructureSetupView, {})
            }).setDisplayStyle("popup"))
        }
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
    }

    set enableWebshopModule(enable: boolean) {
        this.organization.meta.modules.useWebshops = enable
        this.patchModule({ useWebshops: enable }, enable ? "De webshop module is nu actief" : "De webshop module is nu uitgeschakeld")
    }

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        console.log(path);

        if (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'mollie') {
            // Open mollie settings
            this.openPayment(false)
            return
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'general') {
            // Open mollie settings
            this.openGeneral()
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'payments') {
            // Open mollie settings
            this.openPayment(false)
        }

        if (parts.length == 2 && parts[0] == 'settings' && parts[1] == 'personalize') {
            // Open mollie settings
            this.openPersonalize()
        }


        HistoryManager.setUrl("/settings")
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#settings-view {
    .illustration-list img {
        width: 50px;
        height: 50px;
    }

    .module-box {
        display: grid;
        gap: 10px;
        grid-template-columns: 50% 50%;

        > label {
            padding: 30px 20px;
            border-radius: $border-radius;
            background: $color-white-shade;
            display: flex;
            flex-direction: row;     
            align-items: center;    
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
            user-select: none;

            &.selected{
                background: $color-primary-background;
            }

            &.disabled {
                cursor: default;
            }
            
            img {
                width: 50px;
                height: 50px;
            }

            > div:first-child {
                flex-shrink: 0;
                padding-right: 15px;
            }

            > div:last-child {
                margin-left: auto;
                flex-shrink: 0;
                padding-left: 10px;
            }
        }
    }
}

</style>
