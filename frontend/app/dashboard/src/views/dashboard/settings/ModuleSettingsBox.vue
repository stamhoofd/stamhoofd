<template>
    <div class="module-settings-box">
        <div class="module-box">
            <label class="box" :class="{ selected: enableWebshopsTrial }">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/cart.svg"></div>
                <div>
                    <h2 class="style-title-list">Webshops, ticketverkoop, geldinzameling en openbare inschrijvingen</h2>
                    <p v-if="enableWebshopsTrial && !isWebshopsTrial && !loadingWebshopModule" class="style-description">Dit zit in jouw pakket inbegrepen</p>
                    <p v-else class="style-description-small">
                        Het webshop systeem kan gebruikt worden voor gewone webshops, ticketverkopen, crowdfundings en inschrijvingen voor openbare evenementen.
                    </p>
                </div>
                <div>
                    <Spinner v-if="loadingModule == 'TrialWebshops'" />
                    <Checkbox v-else v-model="enableWebshopsTrial" :disabled="!canEnableWebshopModule" />
                </div>
            </label>
            
            <label class="box" :class="{ selected: enableMembersTrial }">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/group.svg"></div>
                <div>
                    <h2 class="style-title-list">Ledenadministratie</h2>
                    <p v-if="enableMembersTrial && !isMembersTrial && !loadingMembers" class="style-description">Dit zit in jouw pakket inbegrepen</p>
                    <p v-else class="style-description-small">Laat leden online inschrijven via een eigen ledenportaal, beheer alle leden, maak attesten aan... Dit is geschikter voor leden die meerdere keren of langere periodes ingeschreven zijn en biedt betere functies voor gegevensverzameling en overzicht.</p>
                </div>
                <div>
                    <Spinner v-if="loadingModule == 'TrialMembers'" />
                    <Checkbox v-else v-model="enableMembersTrial" :disabled="enableMembersTrial && !isMembersTrial" />
                </div>
            </label>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, LoadComponent, Spinner, Toast } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { OrganizationType, PaymentMethod, STInvoiceResponse, STPackageBundle, STPackageType, UmbrellaOrganization } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import ActivatedView from './modules/members/ActivatedView.vue';
import MembersStructureSetupView from './modules/members/MembersStructureSetupView.vue';


@Component({
    components: {
        Checkbox,
        Spinner,
    }
})
export default class ModuleSettingsView extends Mixins(NavigationMixin) {
    loadingModule: STPackageType | null = null
    OrganizationManager = OrganizationManager

    get organization() {
        return OrganizationManager.organization
    }

    get isMembersTrial() {
        return this.organization.meta.packages.isMembersTrial || (this.organization.meta.packages.isActive(STPackageType.LegacyMembers) && !this.organization.meta.packages.isActive(STPackageType.Members) && this.organization.meta.packages.isActive(STPackageType.TrialMembers))
    }

    get isWebshopsTrial() {
        return this.organization.meta.packages.isWebshopsTrial
    }

    get hasLegacy() {
        return this.organization.meta.packages.isActive(STPackageType.LegacyMembers)
    }

    get loadingMembers() {
        return this.loadingModule === STPackageType.TrialMembers
    }

    get enableMembersTrial() {
        if (this.organization.meta.packages.useMembers || this.loadingModule === STPackageType.TrialMembers) {
            return true;
        }
        
        // Check if previously bought the package and not removeAt yet
        return !this.organization.meta.packages.canStartMembersTrial;
    }

    set enableMembersTrial(enable: boolean) {
        /*if (!enable || this.organization.groups.length > 0) {
            this.organization.meta.modules.useMembers = enable
            this.patchModule({ useMembers: enable }, enable ? "De ledenadministratie module is nu actief" : "De ledenadministratie module is nu uitgeschakeld").catch(e => console.error(e))
        } else {
            if (enable && this.organization.meta.umbrellaOrganization && [UmbrellaOrganization.ChiroNationaal, UmbrellaOrganization.ScoutsEnGidsenVlaanderen].includes(this.organization.meta.umbrellaOrganization)) {
                // We have an automated flow for these organizations
                this.present(new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(MembersStructureSetupView, {})
                }).setDisplayStyle("popup"))
            } else {
                // Activate + show groups
                this.patchModule({ useMembers: enable }, enable ? "De ledenadministratie module is nu actief" : "De ledenadministratie module is nu uitgeschakeld").then(() => {
                    // Wait for the backend to fill in all the default categories and groups
                    this.manageGroups(true)
                }).catch(e => console.error(e))
            }
            
        }*/

        if (enable && !this.enableMembersTrial) {
            if (this.organization.meta.type === OrganizationType.Youth && this.organization.meta.umbrellaOrganization && [UmbrellaOrganization.ChiroNationaal, UmbrellaOrganization.ScoutsEnGidsenVlaanderen].includes(this.organization.meta.umbrellaOrganization)) {
                // We have an automated flow for these organizations
                this.present(new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(MembersStructureSetupView, {})
                }).setDisplayStyle("popup"))
            } else {
                this.checkout(STPackageBundle.TrialMembers, "Je kan nu de ledenadministratie uittesten.").catch(e => console.error(e))
            }
        } else {
            if (!enable && this.enableMembersTrial) {
                this.deactivate(STPackageType.TrialMembers, "Het testen van de ledenadministratie is uitgeschakeld").catch(console.error)
            }
        }
    }

    get enableActivities() {
        if (this.organization.meta.packages.useActivities) {
            return true;
        }
        
        // Check if previously bought the package and not removeAt yet
        return !this.organization.meta.packages.canStartMembersTrial;
    }

    set enableActivities(enable: boolean) {
        if (!this.organization.meta.packages.useMembers) {
            return
        }
        if (enable && !this.enableActivities) {
            this.checkout(STPackageBundle.TrialMembers, "Je kan nu activiteiten uittesten").catch(console.error)
        } else {
            if (!enable && this.enableActivities) {
                this.deactivate(STPackageType.TrialMembers, "Het testen van activiteiten is uitgeschakeld").catch(console.error)
            }
        }
    }

    get loadingWebshopModule() {
        return this.loadingModule === STPackageType.TrialWebshops
    }

    get canEnableWebshopModule() {
        if ((this.organization.meta.packages.useWebshops && !this.organization.meta.packages.isWebshopsTrial) || this.loadingModule === STPackageType.TrialWebshops) {
            return false;
        }

        if (this.organization.meta.packages.isWebshopsTrial) {
            // Can disable trial
            return true;
        }

        // Check if previously bought the package and not removeAt yet
        return this.organization.meta.packages.canStartWebshopsTrial;
    }

    get enableWebshopsTrial() {
        // Check if previously bought the package and not removeAt yet
        return this.organization.meta.packages.isWebshopsTrial;
    }

    set enableWebshopsTrial(enable: boolean) {
        //this.organization.meta.modules.useWebshops = enable

        if (enable && !this.enableWebshopsTrial) {
            this.checkout(STPackageBundle.TrialWebshops, "Je kan nu webshops uittesten").catch(console.error)
        } else {
            if (!enable && this.enableWebshopsTrial) {
                this.deactivate(STPackageType.TrialWebshops, "Het testen van webshops is uitgeschakeld").catch(console.error)
            }
        }

    }

    async checkout(bundle: STPackageBundle, message: string) {
        if (this.loadingModule) {
            new Toast("Even geduld, nog bezig met laden...", "info").show()
            return
        }
        this.loadingModule = bundle as any as STPackageType

        try {
            await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/billing/activate-packages",
                body: {
                    bundles: [bundle],
                    paymentMethod: PaymentMethod.Unknown
                },
                decoder: STInvoiceResponse as Decoder<STInvoiceResponse>,
                shouldRetry: false
            })
            await SessionManager.currentSession!.fetchOrganization(false)
            new Toast(message, "success green").show()
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.loadingModule = null
    }

    async deactivate(type: STPackageType, message: string) {
        if (this.loadingModule) {
            return
        }
        this.loadingModule = type

        try {
            const status = await OrganizationManager.loadBillingStatus({
                shouldRetry: false,
                owner: this
            })
            const packages = status.packages
            const pack = packages.find(p => p.meta.type === type)

            if (pack) {
                await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/billing/deactivate-package/"+pack.id,
                    owner: this,
                    shouldRetry: false
                })
                await SessionManager.currentSession!.fetchOrganization(false)
                new Toast(message, "success green").show()
            } else {
                // Update out of date
                await SessionManager.currentSession!.fetchOrganization(false)
            }
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.loadingModule = null
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


.module-settings-box {
    > h3 {
        @extend .style-label;
        padding-bottom: 10px;
        padding-top: 15px;
    }

    .module-box {
        display: grid;
        gap: 10px;
        grid-template-columns: 1fr;

        .box {
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
            padding: 30px 20px;
            border-radius: $border-radius;
            background: $color-background-shade;
            display: flex;
            flex-direction: row;     
            align-items: center;    
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
            user-select: none;

            @media (max-width: 400px) {
                padding: 20px 15px;
            }

            &.selected{
                background: $color-primary-background;
            }

            &.disabled {
                cursor: default;
            }
            
            img {
                @extend .style-illustration-img;
            }

            > div {
                min-width: 0;
                overflow: hidden;
            }

            > div:first-child {
                flex-shrink: 0;
                padding-right: 15px;
            }

            > div:last-child {
                flex-basis: 30px;
                width: 30px;
                min-width: 30px;
                max-width: 30px;
                margin-left: auto;
                flex-shrink: 0;
                padding-left: 10px;
                overflow: visible;
            }
        }
    }
}


</style>
