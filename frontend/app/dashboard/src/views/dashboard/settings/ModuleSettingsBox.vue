<template>
    <div class="module-settings-box">
        <div class="module-box">
            <label v-if="!hasLegacy" class="box" :class="{ selected: enableMemberModule }">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/list.svg"></div>
                <div>
                    <h2 class="style-title-list">Inschrijvingen en ledenbeheer</h2>
                    <p v-if="enableMemberModule && !isMembersTrial" class="style-description">Dit zit in jouw pakket inbegrepen</p>
                    <p v-else class="style-description">Probeer gratis uit</p>
                </div>
                <div>
                    <Spinner v-if="loadingModule == 'TrialMembers'" />
                    <Checkbox v-else v-model="enableMemberModule" :disabled="enableMemberModule && !isMembersTrial" />
                </div>
            </label>

            <label v-else class="box" :class="{ selected: enableActivities }">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/flag.svg"></div>
                <div>
                    <h2 class="style-title-list">Activiteiten</h2>
                    <p v-if="enableActivities && !isMembersTrial" class="style-description">Dit zit in jouw pakket inbegrepen</p>
                    <p v-else class="style-description">Probeer gratis uit</p>
                </div>
                <div>
                    <Spinner v-if="loadingModule == 'TrialMembers'" />
                    <Checkbox v-else v-model="enableActivities" :disabled="enableActivities && !isMembersTrial" />
                </div>
            </label>

            <label class="box" :class="{ selected: enableWebshopModule }">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/cart.svg"></div>
                <div>
                    <h2 class="style-title-list">Webshops &amp; tickets</h2>
                    <p v-if="enableWebshopModule && !isWebshopsTrial" class="style-description">Dit zit in jouw pakket inbegrepen</p>
                    <p v-else class="style-description">Probeer gratis uit</p>
                </div>
                <div>
                    <Spinner v-if="loadingModule == 'TrialWebshops'" />
                    <Checkbox v-else v-model="enableWebshopModule" :disabled="enableWebshopModule && !isWebshopsTrial" />
                </div>
            </label>
        </div>

        <h3>Verwacht in de toekomst</h3>

        <div class="module-box">
            <label class="box disabled">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/laptop.svg"></div>
                <div>
                    <h2 class="style-title-list">Bouw zelf je website</h2>
                    <p class="style-description">Maak een unieke website die je zelf kan aanpassen. Geen technische kennis vereist</p>
                </div>
                <div>
                    <span class="style-tag">2021</span>
                </div>
            </label>

            <label class="box disabled">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/house.svg"></div>
                <div>
                    <h2 class="style-title-list">Verhuur materiaal en lokalen</h2>
                    <p class="style-description">Online reservaties, automatische contracten en kalenders</p>
                </div>
                <div>
                    <span class="style-tag">2021</span>
                </div>
            </label>
        </div>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, Spinner, Toast } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { OrganizationMetaData, OrganizationModules, OrganizationPatch, PaymentMethod, STInvoiceResponse, STPackageBundle, STPackageType, UmbrellaOrganization } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
import { buildManageGroupsComponent } from './buildManageGroupsComponent';
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

    get enableMemberModule() {
        return this.organization.meta.packages.useMembers
    }

    set enableMemberModule(enable: boolean) {
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

        if (enable && !this.enableMemberModule) {
            if (this.organization.meta.umbrellaOrganization && [UmbrellaOrganization.ChiroNationaal, UmbrellaOrganization.ScoutsEnGidsenVlaanderen].includes(this.organization.meta.umbrellaOrganization)) {
                // We have an automated flow for these organizations
                this.present(new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(MembersStructureSetupView, {})
                }).setDisplayStyle("popup"))
            } else {
                this.checkout(STPackageBundle.TrialMembers, "Je kan nu de ledenadministratie uittesten").then(() => {
                    // Wait for the backend to fill in all the default categories and groups
                    this.present(new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(ActivatedView, {})
                    }).setDisplayStyle("popup"))
                }).catch(e => console.error(e))
            }
        } else {
            if (!enable && this.enableMemberModule) {
                this.deactivate(STPackageType.TrialMembers, "Het testen van de ledenadministratie is uitgeschakeld").catch(console.error)
            }
        }
    }

    get enableActivities() {
        return this.organization.meta.modules.useActivities
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

    get enableWebshopModule() {
        return this.organization.meta.packages.useWebshops
    }

    set enableWebshopModule(enable: boolean) {
        //this.organization.meta.modules.useWebshops = enable

        if (enable && !this.enableWebshopModule) {
            this.checkout(STPackageBundle.TrialWebshops, "Je kan nu webshops uittesten").catch(console.error)
        } else {
            if (!enable && this.enableWebshopModule) {
                this.deactivate(STPackageType.TrialWebshops, "Het testen van webshops is uitgeschakeld").catch(console.error)
            }
        }

    }

    async checkout(bundle: STPackageBundle, message: string) {
        if (this.loadingModule) {
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
                decoder: STInvoiceResponse as Decoder<STInvoiceResponse>
            })
            await SessionManager.currentSession!.fetchOrganization()
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
            const status = await OrganizationManager.loadBillingStatus()
            const packages = status.packages
            const pack = packages.find(p => p.meta.type === type)

            if (pack) {
                await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/billing/deactivate-package/"+pack.id,
                })
                await SessionManager.currentSession!.fetchOrganization()
                new Toast(message, "success green").show()
            } else {
                // Update out of date
                await SessionManager.currentSession!.fetchOrganization()
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
    }

    .module-box {
        display: grid;
        gap: 10px;
        grid-template-columns: 50% 50%;
        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));

        // auto-fill is causing a weird unfixable overflow bug, so hard fix it:
        @media (max-width: 800px) {
            grid-template-columns: 100%;
        }

        .box {
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
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
                margin-left: auto;
                flex-shrink: 0;
                padding-left: 10px;
            }
        }
    }
}


</style>
