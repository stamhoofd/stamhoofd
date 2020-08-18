<template>
    <div class="st-view background" id="credits-view">
        <STNavigationBar title="Jouw tegoed">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>
                Jouw tegoed: {{ calculated | price }}
            </h1>
            <p>Breng bevriende verenigingen aan: geef 10 euro cadeau, krijg 25 terug. Actie geldig tot 31 augustus.</p>

            <a href="https://docs.stamhoofd.be/geef-10-euro-cadeau-krijg-25-terug" target="_blank" class="button primary">Info en voorwaarden</a>

            <hr>
            <h2>Jouw doorverwijscode</h2>

            <Spinner v-if="loading"/>
            <input v-else-if="code" class="input" :value="code" @click="copyElement" v-tooltip="'Klik om te kopiëren'" readonly/>

            <template v-if="history.length > 0">
                <hr>
                <h2>Geschiedenis</h2>
                <STList>
                    <STListItem v-for="(item, index) in history" :key="index" class="left-center right-description">
                        <span class="icon arrow-up" v-if="item.change > 0" slot="left"/>
                        <span class="icon clock" v-else-if="item.change == 0" slot="left"/>
                        <span class="icon arrow-down" v-else slot="left"/>

                        <h3 class="style-title-list">{{ item.description }}</h3>
                        <p class="style-description-small">{{ item.date }}</p>
                        <template slot="right">{{ item.change >= 0 ? "+ " : "" }}{{ item.change | price }}</template>
                    </STListItem>
                </STList>
            </template>

        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, STListItem, STList, Spinner, TooltipDirective, Tooltip } from "@stamhoofd/components";
import { SessionManager, LoginHelper } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationMetaData, Image, ResolutionRequest, ResolutionFit, Version, User } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DomainSettingsView from './DomainSettingsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
import ChangePasswordView from './ChangePasswordView.vue';
import { Formatter } from '@stamhoofd/utility';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        STListItem,
        STList,
        Spinner
    },
     directives: {
        tooltip: TooltipDirective
    },
    filters: {
        price: Formatter.price
    }
})
export default class CreditsView extends Mixins(NavigationMixin) {
    loading = true;
    code: string | null = null

    mounted() {
        this.loadCode()
    }

    async loadCode() {
        this.loading = true;

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/register-code",
            })
            this.code = response.data as string
        } catch (e) {
            console.error(e);
            
        }
        this.loading = false
        
    }
    
    get history() {
        return (OrganizationManager.organization!.privateMeta?.credits ?? []).slice().reverse()
    }

    get calculated() {
        return this.history.reduce((a, b) => {
            return a + b.change
        }, 0)
    }

    copyElement(event) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy')

        event.target.contentEditable = false;

        const el = event.target;
        const rect = event.target.getBoundingClientRect();

        // Present

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "📋 Gekopieerd!",
            x: event.clientX,
            y: event.clientY + 10,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));

        setTimeout(() => {
            displayedComponent.vnode?.componentInstance?.$parent.$emit("pop");
        }, 1000);
    }
}
</script>