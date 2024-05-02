<template>
    <LoadingView v-if="loading || !organization" />
    <div v-else class="st-view organization-view">
        <STNavigationBar :title="initialOrganization.name" :pop="canPop" :dismiss="canDismiss">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar vorige bestelling'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende bestelling'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goNext" />
                <button v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>


        <main>
            <h1>
                <span>{{ initialOrganization.name }}</span>
            </h1>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        Adres
                    </h3>
                    <p class="style-definition-text">
                        {{ initialOrganization.address }}
                    </p>
                    <p v-if="organization.meta.companyAddress && organization.meta.companyAddress != initialOrganization.address" class="style-description-small">
                        Facturatieadres: {{ organization.meta.companyAddress }}
                    </p>
                </STListItem>

                <STListItem v-if="initialOrganization.website">
                    <h3 class="style-definition-label">
                        Website
                    </h3>
                    <p class="style-definition-text">
                        {{ initialOrganization.website }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Aangesloten sinds
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateTime(initialOrganization.createdAt) }}
                    </p>
                    <p class="style-description-small">
                        Laatst actief op {{ organization.lastActiveAt ? formatDate(organization.lastActiveAt) : "Nooit" }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Via
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.acquisitionTypes.join(', ') }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Aantal leden
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.stats.memberCount }}
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>
                Instellingen
            </h2>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center right-stack" @click="openAdmins">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/admin.svg"></template>
                    <h2 class="style-title-list">
                        Beheerders
                    </h2>
                    <p class="style-description">
                        Bekijk en bewerk de beheerders.
                    </p>
                    <template #right>
                        <span class="style-description-small">{{ admins.length }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center right-stack" @click="openInvoices">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/transfer.svg"></template>
                    <h2 class="style-title-list">
                        Facturatie
                    </h2>
                    <p class="style-description">
                        Openstaande bedragen, mandaten en facturatiegegevens
                    </p>
                    <template #right>
                        <span class="style-description-small">{{ formatPrice(organization.billingStatus.pendingInvoice ? organization.billingStatus.pendingInvoice.meta.priceWithoutVAT : 0) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>Acties</h2>

            <STList>
                <STListItem :selectable="true" @click="deleteOrganization">
                    <h2 class="style-title-list">
                        Vereniging definitief verwijderen
                    </h2>
                    <p class="style-description">
                        Verwijder deze vereniging en alle daarbij horende gegevens.
                    </p>
                    <template #right>
                        <button type="button" class="button secundary danger hide-smartphone">
                            <span class="icon trash" />
                            <span>Verwijderen</span>
                        </button>
                        <button type="button" class="button icon trash only-smartphone" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, CenteredMessageButton, Checkbox, ContextMenu, ContextMenuItem, LoadingView, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { Country, NewUser, OrganizationMetaData, OrganizationOverview, OrganizationSimple, OrganizationSummary, PermissionLevel, PermissionRole, Permissions, STBillingStatus, STPackage, STPackageBundle, STPackageBundleHelper, STPendingInvoicePrivate, Token, User } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../../classes/AdminSession";
import InvoiceView from "../invoices/InvoiceView.vue";
import CreditsView from "./CreditsView.vue";
import EditPackageView from "./EditPackageView.vue";
import EditUserView from "./EditUserView.vue";
import OrganizationAdminsView from "./OrganizationAdminsView.vue";
import OrganizationInvoicesView from "./OrganizationInvoicesView.vue";


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        LoadingView,
        STInputBox
    },
    filters: {
        price: Formatter.price,
        dateTime: Formatter.dateTime.bind(Formatter)
    },
    directives: { Tooltip },
})
export default class OrganizationView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        initialOrganization!: OrganizationOverview | OrganizationSimple

    organization: OrganizationSummary | null = null
    loading = false

    mounted() {
        this.reload().catch(console.error)
    }

    @Prop({ default: null })
        getNext!: (org: OrganizationOverview | OrganizationSimple) => OrganizationOverview | OrganizationSimple | null;

    @Prop({ default: null })
        getPrevious!: (org: OrganizationOverview | OrganizationSimple) => OrganizationOverview | OrganizationSimple | null;

    get hasNext(): boolean {
        if (!this.getNext || !this.initialOrganization) {
            return false
        }
        return !!this.getNext(this.initialOrganization);
    }

    get hasPrevious(): boolean {
        if (!this.getPrevious || !this.initialOrganization) {
            return false
        }
        return !!this.getPrevious(this.initialOrganization);
    }

    goBack() {
        const initialOrganization = this.getPrevious(this.initialOrganization);
        if (!initialOrganization) {
            return;
        }
        const component = new ComponentWithProperties(OrganizationView, {
            initialOrganization: initialOrganization,
            getNext: this.getNext,
            getPrevious: this.getPrevious,
        });

        this.show({
            components: [component],
            replace: 1,
            reverse: true,
            animated: false
        })
    }

    goNext() {
        const initialOrganization = this.getNext(this.initialOrganization);
        if (!initialOrganization) {
            return;
        }
        const component = new ComponentWithProperties(OrganizationView, {
            initialOrganization: initialOrganization,
            getNext: this.getNext,
            getPrevious: this.getPrevious,
        });

        this.show({
            components: [component],
            replace: 1,
            animated: false
        })
    }

    get mandates() {
        return this.organization?.paymentMandates ?? []
    }

    get balance() {
        return this.organization?.billingStatus?.credits.slice().reverse().reduce((t, c) => {
            if (c.expireAt !== null && c.expireAt < new Date()) {
                return t
            }
            const l = t + c.change
            if (l < 0) {
                return 0
            }
            return l
        }, 0) ?? 0
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date)
    }

    async tryLogin() {
        // Create a refresh token
        const tab =  window.open();
        // Remove focus
        tab!.blur()
        window.focus()

        // Create a random ephemeral password
        const password = Buffer.from(crypto.getRandomValues(new Uint32Array(16))).toString('base64');

        try {
            const user = NewUser.create({
                email: this.initialOrganization.address.country === Country.Belgium ? "hallo@stamhoofd.be" : "hallo@stamhoofd.nl",
                firstName: "Stamhoofd",
                lastName: "Team (tijdelijk account)",
                password
            });

            const response = await AdminSession.shared.authenticatedServer.request({
                method: "POST",
                path: "/organizations/"+this.initialOrganization.id+"/create-admin",
                body: user,
                decoder: Token as Decoder<Token>
            })
            const url = "https://"+STAMHOOFD.domains.dashboard+"/login?organization_id="+encodeURIComponent(this.initialOrganization.id)+"&refresh_token="+encodeURIComponent(response.data.refreshToken)
            
            // Reload data
            this.reload().catch(console.error)

            tab!.location = url as any;
            tab!.focus();
        } catch (e) {
            tab?.close()
            Toast.fromError(e).show()
            console.error(e)
        }
    }

    async patch(patch: AutoEncoderPatchType<OrganizationSummary>) {
        const response = await AdminSession.shared.authenticatedServer.request({
            method: "PATCH",
            path: "/organizations/"+this.initialOrganization.id,
            body: patch,
            decoder: OrganizationSummary as Decoder<OrganizationSummary>
        })
        this.organization = response.data
    }

    async doDelete() {
        try {
            await AdminSession.shared.authenticatedServer.request({
                method: "DELETE",
                path: "/organizations/"+this.initialOrganization.id
            })
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async deleteOrganization() {
        if (!this.organization) {
            return
        }
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze vereniging wilt verwijderen", "Ja, verwijderen", "Je kan dit niet ongedaan maken")) {
            return
        }

        if ((this.organization.meta.packages.useMembers && !this.organization.meta.packages.isMembersTrial) || (this.organization.meta.packages.useWebshops && !this.organization.meta.packages.isWebshopsTrial)) {
            if (!await CenteredMessage.confirm("OPGELET! DIT IS EEN BETALENDE KLANT!!", "Ik ben 100% zeker, verwijderen", "Je kan dit niet ongedaan maken")) {
                return
            }
        }

        await this.doDelete()
    }

    openAdmins() {
        this.show({
            components: [
                new ComponentWithProperties(OrganizationAdminsView, {
                    organization: this.organization
                })
            ],
            animated: true
        })
    }

    openInvoices() {
        this.show({
            components: [
                new ComponentWithProperties(OrganizationInvoicesView, {
                    organization: this.organization
                })
            ],
            animated: true
        })
    }

    async reload() {
        if (this.loading) {
            return
        }
        this.loading = true
        try {
            const response = AdminSession.shared.authenticatedServer.request({
                method: "GET",
                path: "/organizations/"+this.initialOrganization.id,
                decoder: OrganizationSummary as Decoder<OrganizationSummary>
            })
            this.organization = (await response).data
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.loading = false
    }

    get admins() {
        return this.organization?.admins ?? []
    }

    showContextMenu(event) {
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: 'Open dashboard',
                    icon: 'key',
                    action: () => {
                        this.tryLogin().catch(console.error)
                        return true;
                    }
                })
            ],
            [
                ...(this.organization?.website ? [
                    new ContextMenuItem({
                        name: 'Website',
                        description: (this.organization.website ?? '').replace('https://', ''),
                        icon: 'earth',
                        action: () => {
                            window.open(this.organization!.website!, '_blank')
                            return true;
                        }
                    }),
                ] : []),
                ...(this.organization?.registerUrl ? [
                    new ContextMenuItem({
                        name: 'Ledenportaal',
                        description: (this.organization.registerUrl ?? '').replace('https://', ''),
                        icon: 'external',
                        action: () => {
                            window.open(this.organization!.registerUrl, '_blank')
                            return true;
                        }
                    })
                ] : []),
            ], 
            ...(this.organization!.webshops.length ? [
                [
                    new ContextMenuItem({
                        name: 'Webshops',
                        childMenu: new ContextMenu([
                            this.organization!.webshops.map(webshop => {
                                return new ContextMenuItem({
                                    name: webshop.meta.name,
                                    description: (webshop.getUrl(this.organization!) ?? ''),
                                    icon: 'basket',
                                    action: () => {
                                        window.open('https://' + webshop.getUrl(this.organization!), '_blank')
                                        return true;
                                    }
                                })
                            })
                        ])
                    })
                ]
            ] : [])
        ]);

        // Actions

        menu.show({
            button: event.currentTarget
        }).catch(console.error)
    }

}
</script>