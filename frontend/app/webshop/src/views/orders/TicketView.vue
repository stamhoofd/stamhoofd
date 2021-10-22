<template>
    <LoadingView v-if="loading" />
    <div v-else class="st-view order-view shade">
        <STNavigationBar :large="true" :sticky="false">
            <OrganizationLogo slot="left" :organization="organization" />
        </STNavigationBar>

        <main>
            <h1>
                Jouw ticket
            </h1>

            <p>
                Download of deel jouw ticket via deze pagina.
            </p>

            <div class="hide-smartphone">
                <p class="success-box icon environment">
                    Open deze pagina op jouw smartphone om alle tickets digitaal op te slaan. Op die manier hoef je de tickets niet af te drukken. Je kan ook een individueel ticket scannen om enkel dat ticket op te slaan of te delen.
                </p>
            </div>
            <p class="success-box icon environment only-smartphone">
                Je hoeft de tickets niet af te drukken, je kan ze ook tonen op jouw smartphone. Sla ze eventueel op zodat je ze niet kwijt geraakt.
            </p>

            <TicketBox v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" :webshop="webshop" />
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton, LoadingView, OrganizationLogo, Radio, Spinner, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { TicketPublic } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { WebshopManager } from '../../classes/WebshopManager';
import TicketBox from '../products/TicketBox.vue';


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
        Spinner,
        TicketBox
    }
})
export default class TicketView extends Mixins(NavigationMixin){
    loading = true
    
    @Prop({ required: true })
    secret: string 

    tickets: TicketPublic[] = []

    get organization() {
        return WebshopManager.organization
    }

    get webshop() {
        return WebshopManager.webshop
    }

    async downloadTickets() {
        this.loading = true

        try {
            const response = await WebshopManager.server.request({
                method: "GET",
                path: "/webshop/" +WebshopManager.webshop.id + "/tickets",
                query: {
                    // Required because we don't need to repeat item information (network + database impact)
                    secret: this.secret
                },
                decoder: new ArrayDecoder(TicketPublic as Decoder<TicketPublic>)
            })
            this.tickets = response.data
        } catch (e) {
            Toast.fromError(e).show()
        }        

        this.loading = false
    }

    created() {
        this.downloadTickets().catch(console.error)
    }

    mounted() {
        UrlHelper.setUrl(WebshopManager.webshop.getUrlSuffix()+"/tickets/"+this.secret)
    }
}
</script>