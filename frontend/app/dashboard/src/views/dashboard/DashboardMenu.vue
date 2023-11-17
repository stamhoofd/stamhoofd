<template>
    <div class="st-menu st-view dashboard-menu">
        <main ref="main" class="sticky-navigation-bar">
            <STNavigationBar :title="organization.name" :sticky="true" class="block-width">
                <OrganizationSwitcher slot="middle" />
            </STNavigationBar>

            <form v-if="false" class="input-icon-container icon search gray">
                <input class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" spellcheck="false" autocapitalize="off">
            </form>

            <hr class="first">

            <!--<h1 v-if="isNative" @click="switchOrganization">
                <span>{{ organization.name }}</span>
                <span class="icon arrow-down-small gray" />
            </h1>

            <div v-else class="padding-group">
                <Logo />
                <button id="organization-switcher" type="button" @click="switchOrganization">
                    <span class="text">{{ organization.name }}</span>
                    <span class="icon arrow-down-small gray" />
                </button>
            </div>-->


            <button v-if="!enableWebshopModule && !enableMemberModule" type="button" class="menu-button button heading cta" @click="openSignupSelection()">
                <span class="icon flag" />
                <span>Proefperiode starten</span>
            </button>

            <button v-if="enableWebshopModule && canCreateWebshops && webshops.length == 0" type="button" class="menu-button button heading cta" @click="addWebshop()">
                <span class="icon add" />
                <span>Maak je eerste webshop aan</span>
            </button>

            <button v-if="enableMemberModule && tree.categories.length == 0 && fullAccess" type="button" class="menu-button button heading cta" @click="manageGroups(true)">
                <span class="icon settings" />
                <span>Configureer ledenadministratie</span>
            </button>


            <hr v-if="((!enableWebshopModule && !enableMemberModule) || (enableWebshopModule && canCreateWebshops && webshops.length == 0) || enableMemberModule && tree.categories.length == 0 && fullAccess) && ((enableMemberModule && tree.categories.length) || (enableWebshopModule && webshops.length > 0) || fullAccess || canManagePayments || (enableWebshopModule && hasWebshopArchive))">

            <!--<div v-if="enableMemberModule" class="grouped">
                <div class="group-title button">
                    <span>Favorieten</span>
                </div>

                <p class="style-description-small">
                    Voeg inschrijvingsgroepen die je vaak gebruikt toe aan je favorieten. Zo vind je ze snel terug.
                </p>
            </div>-->
            <div class="grouped">
                <button class="group-title menu-button button heading" type="button" :class="{ selected: currentlySelected == 'favourites' }">
                    <span class="icon star" />
                    <span>Favorieten</span>
                    <span class="button icon arrow-down-small right-icon rot" :class="{rot180: isCollapsed('favourites')}" @click="toggleCollapse('favourites')" />
                </button>
            </div>

            <hr>

            <template v-if="enableMemberModule && tree.categories.length">
                <div v-for="(category, index) in tree.categories" :key="category.id" class="container">
                    <div class="grouped">
                        <button class="group-title menu-button button heading" type="button" :class="{ selected: currentlySelected == 'category-'+category.id }" @click="openCategory(category)">
                            <span v-if="category.categories.length" class="icon category" />
                            <span v-else class="icon layered">
                                <span class="icon group-layer-1" />
                                <span class="icon group-layer-2 gray" />
                            </span>
                            <span>{{ category.settings.name }}</span>
                            <span v-if="isCategoryDeactivated(category)" v-tooltip="'Deze categorie is onzichtbaar voor leden omdat activiteiten niet geactiveerd is'" class="icon error red right-icon" />
                            <span class="button icon arrow-down-small right-icon rot" :class="{rot180: isCollapsed(category.id)}" @click="toggleCollapse(category.id)" />
                        </button>

                        <div :class="{collapsable: true, hide: isCollapsed(category.id)}">
                            <button
                                v-for="c in category.categories"
                                :key="c.id"
                                class="menu-button button sub-button"
                                :class="{ selected: currentlySelected == 'category-'+c.id }"
                                type="button"
                                @click="openCategory(c)"
                            >
                                <span class="icon gray small" />
                                <span>{{ c.settings.name }}</span>
                            </button>

                            <button
                                v-for="group in category.groups"
                                :key="group.id"
                                class="menu-button button sub-button"
                                :class="{ selected: currentlySelected == 'group-'+group.id }"
                                type="button"
                                @click="openGroup(group)"
                            >
                                <GroupAvatar :group="group" />
                                <span>{{ group.settings.name }}</span>
                                <span v-if="group.settings.registeredMembers !== null" class="count">{{ group.settings.registeredMembers }}</span>
                            </button>

                            <hr v-if="index < tree.categories.length - 1">
                        </div>
                    </div>
                </div>
                <hr v-if="(enableWebshopModule && webshops.length > 0) || fullAccess || canManagePayments || (enableWebshopModule && hasWebshopArchive)">
            </template>

            <div v-if="enableWebshopModule && webshops.length > 0" class="container">
                <div class="grouped">
                    <div class="group-title menu-button button">
                        <span class="icon layered">
                            <span class="icon basket-layer-1 primary-light" />
                            <span class="icon basket-layer-2" />
                        </span>
                        <span>Webshops</span>
                        <button v-if="canCreateWebshops" type="button" class="button icon add gray" @click="addWebshop()" />
                    </div>

                    <button
                        v-for="webshop in webshops"
                        :key="webshop.id"
                        type="button"
                        class="menu-button button sub-button"
                        :class="{ selected: currentlySelected == 'webshop-'+webshop.id }"
                        @click="openWebshop(webshop)"
                    >
                        <span v-if="isWebshopOpen(webshop)" class="icon dot small green " />
                        <span v-else class="icon gray small" />
                        <span>{{ webshop.meta.name }}</span>
                    </button>
                </div>
                <hr v-if="fullAccess || canManagePayments || (enableWebshopModule && hasWebshopArchive)">
            </div>

            <button v-if="enableMemberModule && fullAccess" type="button" class="menu-button button heading" :class="{ selected: currentlySelected == 'member-archive'}" @click="openMemberArchive(true)"> 
                <span class="icon layered">
                    <span class="icon archive-layer-1 primary-light" />
                    <span class="icon archive-layer-2 " />
                </span>
                <span>Leden</span>
            </button>

            <button v-if="enableWebshopModule && hasWebshopArchive" type="button" class="menu-button button heading" :class="{ selected: currentlySelected == 'webshop-archive'}" @click="openWebshopArchive(true)"> 
                <span class="icon layered">
                    <span class="icon archive-layer-1 primary-light" />
                    <span class="icon archive-layer-2 " />
                </span>
                <span>Webshops</span>
            </button>

            <button v-if="fullAccess && enableMemberModule" type="button" class="menu-button button heading" :class="{ selected: currentlySelected == 'documents'}" @click="openDocuments(true)"> 
                <span class="icon file-filled" />
                <span>Documenten</span>
            </button>

            <button v-if="canManagePayments" type="button" class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-finances'}" @click="openFinances(true)"> 
                <span class="icon calculator" />
                <span>Boekhouding</span>
            </button>

            <div v-if="fullAccess">
                <button type="button" class="menu-button button heading" :class="{ selected: currentlySelected == 'manage-settings'}" @click="manageSettings(true)">
                    <span class="icon settings" />
                    <span>Instellingen</span>
                </button>
            </div>

            <div class="grouped footer">
                <hr>

                <button class="menu-button button heading" type="button" @click="manageWhatsNew()">
                    <span class="icon gift" />
                    <span>Wat is er nieuw?</span>
                    <span v-if="whatsNewBadge" class="bubble">{{ whatsNewBadge }}</span>
                </button>

                <a class="menu-button button heading" :href="'https://'+$t('shared.domains.marketing')+'/docs'" target="_blank">
                    <span class="icon book" />
                    <span>Documentatie</span>
                </a>

                <button v-if="!isAppReview" type="button" class="menu-button button heading" @click="gotoFeedback(false)">
                    <span class="icon feedback" />
                    <span>Feedback</span>
                </button>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentWithProperties, NavigationController, NavigationMixin, SplitViewController } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, GlobalEventBus, GroupAvatar, LoadComponent, Logo, STNavigationBar, TooltipDirective } from '@stamhoofd/components';
import { AppManager, SessionManager, Storage, UrlHelper } from '@stamhoofd/networking';
import { Country, Group, GroupCategory, GroupCategoryTree, OrganizationType, Permissions, PrivateWebshop, UmbrellaOrganization, WebshopPreview, WebshopStatus } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { openNolt } from "../../classes/NoltHelper";
import { OrganizationManager } from '../../classes/OrganizationManager';
import { WhatsNewCount } from '../../classes/WhatsNewCount';
import OrganizationSwitcher from './OrganizationSwitcher.vue';
import InvoicePaymentStatusView from "./settings/packages/InvoicePaymentStatusView.vue";

@Component({
    components: {
        Logo,
        STNavigationBar,
        OrganizationSwitcher,
        GroupAvatar
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class DashboardMenu extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    currentlySelected: string | null = null
    whatsNewBadge = ""
    OrganizationManager = OrganizationManager
    collapsedSections: string[] = []

    get organization() {
        return OrganizationManager.organization
    }

    get userName() {
        return SessionManager.currentSession?.user ? (SessionManager.currentSession.user.firstName + ' ' + SessionManager.currentSession.user.lastName):  ""
    }

    get isNative() {
        return AppManager.shared.isNative
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    get tree() {
        return this.organization.getCategoryTree({
            permissions: OrganizationManager.user.permissions ?? Permissions.create({})
        })
    }

    getGroupImageSrc(group: Group) {
        return (group.settings.squarePhoto ?? group.settings.coverPhoto)?.getPathForSize(24, 24)
    }

    isWebshopOpen(webshop: WebshopPreview) {
        return !webshop.isClosed()
    }

    get logoSrc() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 50)
    }

    get logoSrcSet() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 50) + " 1x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 50*2)+" 2x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 50*3)+" 3x"
    }

    toggleCollapse(id: string) {
        if (this.collapsedSections.includes(id)) {
            this.collapsedSections = this.collapsedSections.filter(i => i != id)
        } else {
            this.collapsedSections.push(id)
        }
        this.saveCollapsed().catch(console.error)
    }

    isCollapsed(id: string) {
        return this.collapsedSections.includes(id)
    }

    async saveCollapsed() {
        await Storage.keyValue.setItem("dm-c", JSON.stringify(this.collapsedSections))
    }

    async loadCollapsed() {
        const value = await Storage.keyValue.getItem("dm-c")
        if (value) {
            this.collapsedSections = JSON.parse(value)
        }
    }

    mounted() {
        // First set current url already
        UrlHelper.setUrl("/")

        const parts = UrlHelper.shared.getParts()
        const params = UrlHelper.shared.getSearchParams()

        let didSet = false

        if ((parts.length >= 1 && parts[0] == 'settings') || (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'mollie') || (parts.length >= 1 && parts[0] == 'scouts-en-gidsen-vlaanderen') || (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'sgv')) {
            if (this.fullAccess) {
                this.manageSettings(false).catch(console.error)
                didSet = true
            }
        }

        if (parts.length >= 1 && parts[0] == 'finances' || (!this.fullAccess && (parts.length >= 1 && parts[0] == 'settings'))) {
            if (this.canManagePayments) {
                this.openFinances(false).catch(console.error)
                didSet = true
            }
        }

        if (parts.length >= 1 && parts[0] == 'account') {
            this.manageAccount(false).catch(console.error).finally(() => UrlHelper.shared.clear())
            didSet = true
        }

        if ((parts.length >= 1 && parts[0] == 'documents')) {
            if (this.fullAccess && this.isBelgium && this.enableMemberModule) {
                this.openDocuments(false).catch(console.error)
                didSet = true
            }
        }        

        if ((parts.length >= 1 && parts[0] == 'archived-groups')) {
            if (this.fullAccess && this.enableMemberModule) {
                this.openMemberArchive(false).catch(console.error)
                didSet = true
            }
        }

        if ((parts.length == 2 && parts[0] == 'auth' && parts[1] == 'nolt')) {
            this.gotoFeedback(true).catch(console.error).finally(() => UrlHelper.shared.clear())
        }

        if (!didSet && this.enableMemberModule && parts.length >= 2 && parts[0] == "category") {
            for (const category of this.organization.meta.categories) {
                if (parts[1] == Formatter.slug(category.settings.name)) {
                    if (parts[2] && parts[2] == "all") {
                        this.openCategoryMembers(category, false).catch(console.error)
                    } else {
                        this.openCategory(category, false).catch(console.error).finally(() => UrlHelper.shared.clear())
                    }
                    didSet = true
                    break;
                }
            }
        }

        if (!didSet && this.enableMemberModule && parts.length >= 2 && parts[0] == "groups") {
            for (const group of this.organization.groups) {
                if (parts[1] == Formatter.slug(group.settings.name)) {
                    this.openGroup(group, false).catch(console.error)
                    didSet = true
                    break;
                }
            }
        }

        if (!didSet && this.enableWebshopModule && parts.length >= 2 && parts[0] == "webshops") {
            for (const webshop of this.organization.webshops) {
                if (parts[1] == Formatter.slug(webshop.meta.name)) {
                    this.openWebshop(webshop, false).catch(console.error)
                    didSet = true
                    break;
                }
            }
        }
        
        if (!didSet && !this.splitViewController?.shouldCollapse()) {
            UrlHelper.shared.clear()
            if (this.fullAccess) {
                this.manageSettings(false).catch(console.error)
            } else if (this.canManagePayments) {
                this.openFinances(false).catch(console.error)
            } else {
                this.manageAccount(false).catch(console.error)
            }
        }

        document.title = "Stamhoofd - "+OrganizationManager.organization.name

        const currentCount = localStorage.getItem("what-is-new")
        if (currentCount) {
            const c = parseInt(currentCount)
            if (!isNaN(c) && WhatsNewCount - c > 0) {
                this.whatsNewBadge = (WhatsNewCount - c).toString()
            }
        } else {
            localStorage.setItem("what-is-new", (WhatsNewCount as any).toString());
        }

        if (!didSet && this.fullAccess) {
            console.log('openSignupSelection')
            if (!this.organization.meta.modules.useMembers && !this.organization.meta.modules.useWebshops) {
                this.openSignupSelection(true).catch(console.error);
            }
        }

        GlobalEventBus.addListener(this, "new-webshop", async (webshop: PrivateWebshop) => {
            await this.openWebshop(webshop, false)
        })

        if (this.fullAccess && !this.organization.meta.didAcceptLatestTerms) {
            // Show new terms view if needed
            LoadComponent(() => import(/* webpackChunkName: "AcceptTermsView" */ "./AcceptTermsView.vue"), {}, { instant: true }).then((component) => {
                this.present(component.setDisplayStyle("popup").setAnimated(false))
            }).catch(console.error)
        }

        if (parts.length == 3 && parts[0] == 'settings' && parts[1] == 'billing' && parts[2] == 'payment') {
            this.present({
                animated: false,
                adjustHistory: false,
                modalDisplayStyle: "popup",
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(InvoicePaymentStatusView, {
                            paymentId: params.get("id")
                        })
                    })
                ]})
        }
    }

    get isAppReview() {
        return AppManager.shared.isNative && this.organization.id === "34541097-44dd-4c68-885e-de4f42abae4c"
    }

    get webshops() {
        return this.organization.webshops
            .filter(webshop => webshop.meta.status !== WebshopStatus.Archived)
            .sort((a, b) => Sorter.stack(Sorter.byBooleanValue(b.isClosed(), a.isClosed()), Sorter.byStringValue(a.meta.name, b.meta.name)))
    }

    get hasWebshopArchive() {
        return this.organization.webshops.some(webshop => webshop.meta.status == WebshopStatus.Archived)
    }

    switchOrganization() {
        SessionManager.deactivateSession()
    }

    async openSignupSelection(animated = true) {
        await LoadComponent(() => import(/* webpackChunkName: "SignupModulesView" */ "../signup/SignupModulesView.vue"), {}, { instant: true }).then((component) => {
            this.present(component.setDisplayStyle("popup").setAnimated(animated))
        })
    }

    async openGroup(group: Group, animated = true) {
        this.currentlySelected = "group-"+group.id
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "GroupOverview", webpackPrefetch: true */  "./groups/GroupOverview.vue"), { group }, { instant: !animated })
                })
            ]}
        );
    }

    async openCategory(category: GroupCategory, animated = true) {
        //if (category.categoryIds.length > 0 && category.groupIds.length == 0) {
        //    // Open a stacked split view controller
        //    this.currentlySelected = "category-"+category.id
        //    this.showDetail({
        //        adjustHistory: animated,
        //        animated,
        //        components: [
        //            new ComponentWithProperties(SplitViewController, {
        //                root: new ComponentWithProperties(NavigationController, { 
        //                    root: await LoadComponent(() => import(/* webpackChunkName: "CategoryMenu", webpackPrefetch: true */ "./groups/CategoryMenu.vue"), { category }, { instant: !animated })
        //                })
        //            })
        //        ]}
        //    );
        //    return;
        //}

        this.currentlySelected = "category-"+category.id
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "CategoryView", webpackPrefetch: true */ "./groups/CategoryView.vue"), { category }, { instant: !animated })
                })
            ]}
        );
    }

    async openCategoryMembers(category: GroupCategory, animated = true) {
        this.currentlySelected = "category-"+category.id

        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "GroupMembersView", webpackPrefetch: true */ "./groups/GroupMembersView.vue"), {
                        category: GroupCategoryTree.build(category, this.organization.meta.categories, this.organization.groups)
                    }, { instant: !animated })
                })
            ]
        });
    }

    async openWebshop(webshop: WebshopPreview, animated = true) {
        this.currentlySelected = "webshop-"+webshop.id
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "WebshopOverview", webpackPrefetch: true */ './webshop/WebshopOverview.vue'), { preview: webshop }, { instant: !animated })
                })
            ]}
        );
    }

    async openWebshopArchive(animated = true) {
        this.currentlySelected = "webshop-archive"

        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "WebshopArchiveView" */  "./webshop/WebshopArchiveView.vue"), {  }, { instant: !animated })
                })
            ]}
        );
    }

    async openMemberArchive(animated = true) {
        this.currentlySelected = "member-archive"

        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "ArchivedGroupsView" */  "./groups/ArchivedGroupsView.vue"), {  }, { instant: !animated })
                })
            ]}
        );
    }

    async openFinances(animated = true) {
        this.currentlySelected = "manage-finances"
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "FinancesView", webpackPrefetch: true */ './settings/FinancesView.vue'), {}, { instant: !animated })
                })
            ]
        });
    }

    async manageSettings(animated = true) {
        this.currentlySelected = "manage-settings"
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "SettingsView", webpackPrefetch: true */ './settings/SettingsView.vue'), {}, { instant: !animated })
                })
            ],
        });
    }

    async manageAccount(animated = true) {
        this.currentlySelected = "manage-account"
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "AccountSettingsView", webpackPrefetch: true */ './account/AccountSettingsView.vue'), {}, { instant: !animated })
                })
            ]
        });
    }

    manageWhatsNew() {
        this.whatsNewBadge = ""

        window.open('https://'+this.$t('shared.domains.marketing')+'/changelog', '_blank');
        localStorage.setItem("what-is-new", WhatsNewCount.toString());
    }

    async logout() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je wilt uitloggen?", "Uitloggen")) {
            return;
        }
        SessionManager.logout()
    }

    async openDocuments(animated = true) {
        this.currentlySelected = "documents"
        this.showDetail({
            adjustHistory: animated,
            animated,
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "DocumentTemplatesView" */'./documents/DocumentTemplatesView.vue'), {}, { instant: !animated })
                })
            ]
        });
    }

    async manageGroups(animated = true) {
        this.present({
            animated,
            adjustHistory: animated,
            modalDisplayStyle: "popup",
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: await LoadComponent(() => import(/* webpackChunkName: "ActivatedView" */'./settings/modules/members/ActivatedView.vue'), {}, { instant: !animated })
                })
            ]
        })
    }

    async addWebshop() {
        this.present(
            (await LoadComponent(() => import(/* webpackChunkName: "EditWebshopGeneralView" */ './webshop/edit/EditWebshopGeneralView.vue'))).setDisplayStyle("popup")
        )
    }

    get canCreateWebshops() {
        const result = SessionManager.currentSession!.user!.permissions!.canCreateWebshops(this.organization.privateMeta?.roles ?? [])
        return result
    }

    get canManagePayments() {
        return SessionManager.currentSession!.user!.permissions!.canManagePayments(this.organization.privateMeta?.roles ?? [])
    }

    get fullAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasFullAccess()
    }

    get fullReadAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasReadAccess()
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
    }

    isCategoryDeactivated(category: GroupCategoryTree) {
        return this.organization.isCategoryDeactivated(category)
    }

    async gotoFeedback(check = false) {
        await openNolt(check)
    }
}
</script>

<style lang="scss">
.dashboard-menu {
    --block-width: 40px;

    @media (max-width: 600px) {
        --block-width: 55px;
    }
}
</style>