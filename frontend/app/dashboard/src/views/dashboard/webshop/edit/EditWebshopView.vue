<template>
    <div class="st-view webshop-view">
        <STNavigationBar :title="title">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="!isNew" class="button text" @click="deleteWebshop">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">{{ title }}</span>
        </STNavigationTitle>

        <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />

        <component :is="tab" :webshop="patchedWebshop" @patch="patch" />

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, STNavigationTitle, Toast } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, GlobalEventBus,LoadingButton,SegmentedControl, STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { PermissionRole, WebshopTicketType } from '@stamhoofd/structures';
import { PermissionLevel, PrivateWebshop, Version, WebshopPreview } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import EditWebshopGeneralView from './EditWebshopGeneralView.vue';
import EditWebshopPageView from './EditWebshopPageView.vue';
import EditWebshopProductsView from './EditWebshopProductsView.vue';

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        BackButton,
        STToolbar,
        LoadingButton
    },
})
export default class EditWebshopView extends Mixins(NavigationMixin) {
    tabs = [EditWebshopGeneralView, EditWebshopProductsView, EditWebshopPageView];
    tab = this.tabs[0];

    @Prop({ default: null })
    editWebshop: PrivateWebshop | null
    webshop: PrivateWebshop

    webshopPatch = PrivateWebshop.patch({})
    isNew = true
    saving = false

    get tabLabels() {
        if (this.patchedWebshop.meta.ticketType === WebshopTicketType.Tickets) {
            return ["Algemeen", "Tickets", "Pagina"]
        }
        return ["Algemeen", "Artikels", "Pagina"]
    }

    created() {
        if (this.editWebshop) {
            this.isNew = false
            this.webshop = this.editWebshop

            // Reload to make sure the stock is up to date
            SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/webshop/"+this.webshop.id,
                decoder: PrivateWebshop as Decoder<PrivateWebshop>
            }).then((response) => {
                this.webshop.set(response.data)
            }).catch((e) => {
                console.error(e)
                Toast.fromError(e).show()
            })
        } else {
            this.webshop = PrivateWebshop.create({})
            this.webshop.meta.paymentMethods = OrganizationManager.organization.meta.paymentMethods

            // Auto assign roles
            if (OrganizationManager.user.permissions && this.webshop.privateMeta.permissions.getPermissionLevel(OrganizationManager.user.permissions) !== PermissionLevel.Full) {
                const roles = OrganizationManager.user.permissions.roles.filter(r => {
                    const role = OrganizationManager.organization.privateMeta?.roles.find(i => i.id === r.id)
                    if (role && role.createWebshops) {
                        return true
                    }
                    return false
                }).map(r => PermissionRole.create(r))
                this.webshop.privateMeta.permissions.full.push(...roles)
            }
        }
    }

    get patchedWebshop() {
        return this.webshop.patch(this.webshopPatch)
    }

    get title() {
        if (!this.isNew) {
            return this.webshop.meta.name+" wijzigen"
        }
        return "Webshop of ticketverkoop starten"
    }

    patch(patch: AutoEncoderPatchType<PrivateWebshop>) {
        this.webshopPatch = this.webshopPatch.patch(patch)
    }

    async deleteWebshop() {
        if (!confirm("Ben je zeker dat je deze webshop en alle bijhorende bestellingen definitief wilt verwijderen?")) {
            return;
        }

        try {
            await SessionManager.currentSession!.authenticatedServer.request({
                method: "DELETE",
                path: "/webshop/"+this.webshop.id,
                shouldRetry: false
            })
            new Toast("Webshop verwijderd", "success green").show()

            OrganizationManager.organization.webshops = OrganizationManager.organization.webshops.filter(w => w.id != this.webshop.id)
            this.dismiss({ force: true })
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async save() {
        if (this.saving) {
            return
        }

        this.saving = true

        try {
            if (this.patchedWebshop.meta.name.length === 0) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Name is empty",
                    human: "Vul een naam in voor jouw webshop voor je doorgaat",
                    field: "name"
                })
            }
            if (this.isNew) {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/webshop",
                    body: this.patchedWebshop,
                    decoder: PrivateWebshop as Decoder<PrivateWebshop>,
                    shouldRetry: false
                })

                this.webshopPatch = PrivateWebshop.patch({})
                this.webshop.set(response.data)
                this.isNew = false

                new Toast("Webshop opgeslagen", "success green").show()

                OrganizationManager.organization.webshops.push(WebshopPreview.create(this.webshop))
                await GlobalEventBus.sendEvent("new-webshop", this.webshop)
            } else {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "PATCH",
                    path: "/webshop/"+this.webshop.id,
                    body: this.webshopPatch,
                    decoder: PrivateWebshop as Decoder<PrivateWebshop>
                })

                this.webshopPatch = PrivateWebshop.patch({})
                this.webshop.set(response.data)

                // Clone data and keep references
                OrganizationManager.organization.webshops.find(w => w.id == this.webshop.id)?.set(response.data)

                new Toast("Wijzigingen opgeslagen", "success green").show()
            }

            this.dismiss({ force: true })
        } catch (e) {
            console.error("Failed")
            console.error(e)
            Toast.fromError(e).show()
        }

        this.saving = false
    }

    isChanged() {
        return this.isNew || patchContainsChanges(this.webshopPatch, this.webshop, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.webshop-view {
    > main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
}
</style>
