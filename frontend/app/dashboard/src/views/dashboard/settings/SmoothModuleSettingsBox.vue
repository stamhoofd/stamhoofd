<template>
    <div class="container">
        <SegmentedControl v-model="selectedItem" :items="items" :labels="labels" />
        <STList v-if="selectedItem === 'all' || selectedItem === 'webshops'" class="illustration-list">    
            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Performance)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/stage.svg">
                <h2 class="style-title-list smaller">
                    Zaalvoorstelling met tickets
                </h2>
                <p class="style-description-smaller">
                    Verkoop tickets met vaste plaatsen of vrije plaatsen voor een voorstelling, bv. een toneelstuk.
                </p>
                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Event)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/tickets.svg">
                <h2 class="style-title-list smaller">
                    Evenement met tickets
                </h2>
                <p class="style-description-smaller">
                    Verkoop tickets en scan de QR-codes met onze app.
                </p>
                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Registrations)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                <h2 class="style-title-list smaller">
                    Inschrijvingen voor (openbare) evenementen verzamelen
                </h2>
                <p class="style-description-smaller">
                    Je organiseert een eetfestijn, een quiz, ... Je wilt, zonder dat bezoekers moeten inloggen, snel inschrijvingen verzamelen.
                </p>
                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.TakeawayAndDelivery)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/truck.svg">
                <h2 class="style-title-list smaller">
                    Take-away en/of levering
                </h2>
                <p class="style-description-smaller">
                    Bv. verkoop zelfgemaakte spaghettisaus of kerstkaarten. Af te halen of te leveren.
                </p>
                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Webshop)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/cart.svg">
                <h2 class="style-title-list smaller">
                    Een webshop bouwen
                </h2>
                <p class="style-description-smaller">
                    Bouw een webshop om producten te verkopen, bv. T-shirts.
                </p>
                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Donations)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/charity.svg">
                <h2 class="style-title-list smaller">
                    Donaties of inzameling
                </h2>
                <p class="style-description-smaller">
                    Maak een webshop waarop mensen een gift kunnen doen aan de hand van een overschrijving of Bancontact.
                </p>
                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
        <hr v-if="selectedItem === 'all'">
        <STList v-if="selectedItem === 'all' || selectedItem === 'members'" class="illustration-list">
            <STListItem :selectable="true" class="left-center" @click="setupMemberAdministration()">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/team.svg">
                <h2 class="style-title-list smaller">
                    Ledenadministratie gebruiken
                </h2>
                <p class="style-description-smaller">
                    Gegevens van leden online beheren, online inschrijvingen voor activiteiten voor leden en ledenportaal voor leden
                </p>
                <template slot="right">
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, LoadComponent, SegmentedControl,Spinner, Toast } from "@stamhoofd/components";
import { STList } from '@stamhoofd/components';
import { STListItem } from '@stamhoofd/components';
import { SessionManager } from '@stamhoofd/networking';
import { OrganizationType, PaymentMethod, STInvoiceResponse, STPackageBundle, STPackageType, UmbrellaOrganization, WebshopType } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import ActivatedView from './modules/members/ActivatedView.vue';
import MembersStructureSetupView from './modules/members/MembersStructureSetupView.vue';


@Component({
    components: {
        Checkbox,
        Spinner,
        STList,
        STListItem,
        SegmentedControl
    }
})
export default class SmoothModuleSettingsBox extends Mixins(NavigationMixin) {
    loadingModule: STPackageType | null = null
    OrganizationManager = OrganizationManager

    items = [ "webshops", "members" ]
    labels = [ "Verkoop", "Ledenadministratie" ]
    selectedItem = "webshops"

    get organization() {
        return OrganizationManager.organization
    }

    get WebshopType() {
        return WebshopType
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

    get enableMemberModule() {
        if (this.organization.meta.packages.useMembers || this.loadingModule === STPackageType.TrialMembers) {
            return true;
        }
        
        // Check if previously bought the package and not removeAt yet
        return !this.organization.meta.packages.canStartMembersTrial;
    }

    setupMemberAdministration() {
        if (this.organization.groups.length === 0 && this.organization.meta.type === OrganizationType.Youth && (!this.organization.meta.umbrellaOrganization || [UmbrellaOrganization.ChiroNationaal, UmbrellaOrganization.ScoutsEnGidsenVlaanderen].includes(this.organization.meta.umbrellaOrganization))) {
            // We have an automated flow for these organizations
            this.show({
                components: [
                    new ComponentWithProperties(MembersStructureSetupView, {})
                ]
            })
        } else {
            this.checkout(STPackageBundle.TrialMembers, "Je kan nu de ledenadministratie uittesten.").then(() => {
                // Wait for the backend to fill in all the default categories and groups
                this.show({
                    components: [
                        new ComponentWithProperties(ActivatedView, {})
                    ]
                })
            }).catch(e => console.error(e))
        }
    }

    async createWebshop(type: WebshopType) {
        this.show({
            components: [
                (
                    await LoadComponent(
                        () => import(/* webpackChunkName: "EditWebshopGeneralView" */ '../webshop/edit/EditWebshopGeneralView.vue'),
                        { 
                            forceType: type,
                            beforeSaveHandler: async () => {
                                await this.checkout(STPackageBundle.TrialWebshops, "");
                            }
                        },
                        { instant: true }
                    )
                )
            ],
        })
    }

    get loadingWebshopModule() {
        return this.loadingModule === STPackageType.TrialWebshops
    }

    get enableWebshopModule() {
        if (this.organization.meta.packages.useWebshops || this.loadingModule === STPackageType.TrialWebshops) {
            return true;
        }

        // Check if previously bought the package and not removeAt yet
        return !this.organization.meta.packages.canStartWebshopsTrial;
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

            if (message) {
                new Toast(message, "success green").show()
            }
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.loadingModule = null
    }

}
</script>