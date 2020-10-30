<template>
    <div class="st-view webshop-view background">
        <STNavigationBar :sticky="false">
            <template #left>
                <BackButton v-if="canPop" slot="left" @click="pop" />
                <STNavigationTitle v-else>
                    <span class="icon-spacer">{{ title }}</span>

                    <button class="button text" @click="editSettings">
                        <span class="icon settings" />
                        <span>Instellingen</span>
                    </button>
                </STNavigationTitle>
            </template>
            <template #middle>
                <div />
            </template>
        </STNavigationBar>
    
        <main>
            <h1 v-if="canPop">
                <span class="icon-spacer">{{ title }}</span>

                <button class="button text" @click="editSettings">
                    <span class="icon settings" />
                    <span>Instellingen</span>
                </button>
            </h1>

            <Spinner v-if="loading" class="center" />
            <p v-if="!loading" class="info-box">
                Je hebt nog geen bestellingen ontvangen
            </p>
           
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { SegmentedControl,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, LoadingButton,Spinner, STNavigationTitle } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { EncryptedMemberWithRegistrationsPatch, Group, Member,MemberWithRegistrations, PrivateWebshop, Registration, WaitingListType, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { CanNotSwimFilter, NoFilter, NotPaidFilter, RecordTypeFilter } from "../../../classes/member-filters";
import { MemberChangeEvent,MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import MailView from "../mail/MailView.vue";
import EditMemberView from '../member/edit/EditMemberView.vue';
import MemberContextMenu from "../member/MemberContextMenu.vue";
import MemberSummaryView from '../member/MemberSummaryView.vue';
import MemberView from "../member/MemberView.vue";
import EditWebshopView from './EditWebshopView.vue';
import GroupListSelectionContextMenu from "./GroupListSelectionContextMenu.vue";

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STNavigationTitle,
        STToolbar,
        BackButton,
        Spinner,
        LoadingButton,
        SegmentedControl
    },
    directives: { Tooltip },
})
export default class WebshopView extends Mixins(NavigationMixin) {
    @Prop()
    preview: WebshopPreview ;
    webshop: PrivateWebshop | null = null
    loading = false;

    mounted() {
        this.reload();
    }

    reload() {
        this.loading = true;

        SessionManager.currentSession!.authenticatedServer.request({
            method: "GET",
            path: "/webshop/"+this.preview.id,
            decoder: PrivateWebshop as Decoder<PrivateWebshop>
        }).then((response) => {
            this.webshop = response.data

            // Clone data and keep references
            OrganizationManager.organization.webshops.find(w => w.id == this.preview.id)?.set(response.data)
        }).catch((e) => {
            console.error(e)
        }).finally(() => {
            this.loading = false
        })
    }

    get title() {
        return this.webshop?.meta?.name ?? this.preview.meta.name
    }

    editSettings() {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditWebshopView, {
                editWebshop: this.webshop
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
