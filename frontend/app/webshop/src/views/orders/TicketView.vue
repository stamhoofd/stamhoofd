<template>
    <LoadingView v-if="loading" />
    <div v-else class="st-view ticket-view">
        <STNavigationBar v-if="!$isMobile" :large="!true" :sticky="false">
            <OrganizationLogo #left :organization="organization" />
        </STNavigationBar>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, DetailedTicketView,LoadingButton, LoadingView, OrganizationLogo, Radio, Spinner, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { TicketPublic } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { WebshopManager } from '../../classes/WebshopManager';


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        LoadingView,
        BackButton,
        OrganizationLogo,
        Spinner
    }
})
export default class TicketView extends Mixins(NavigationMixin){
    loading = true
    
    @Prop({ required: true })
        secret: string 

    tickets: TicketPublic[] = []

    get organization() {
        return this.$webshopManager.organization
    }

    get webshop() {
        return this.$webshopManager.webshop
    }

    async downloadTickets() {
        this.loading = true

        try {
            const response = await this.$webshopManager.server.request({
                method: "GET",
                path: "/webshop/" +this.$webshopManager.webshop.id + "/tickets",
                query: {
                    // Required because we don't need to repeat item information (network + database impact)
                    secret: this.secret
                },
                decoder: new ArrayDecoder(TicketPublic as Decoder<TicketPublic>)
            })
            this.tickets = response.data
            this.openTicket();
        } catch (e) {
            Toast.fromError(e).show()
        }        

        this.loading = false
    }

    openTicket() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(DetailedTicketView, {
                        ticket: this.tickets[0],
                        webshop: this.webshop,
                        organization: this.organization,
                        allowDismiss: false,
                        logo: !!(this as any).$isMobile
                    })
                })
            ],
            modalDisplayStyle: "sheet",
            animated: false
        })
    }


    created() {
        this.downloadTickets().catch(console.error)
    }

    mounted() {
        UrlHelper.setUrl("/tickets/"+this.secret)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.ticket-view {
    --box-width: 400px;
}
</style>