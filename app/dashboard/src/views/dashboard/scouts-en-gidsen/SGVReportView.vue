<template>
    <div class="st-view" id="sgv-report-view">
        <STNavigationBar title="Overzicht">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button icon close gray" v-if="canDismiss" @click="dismiss"/>
        </STNavigationBar>

        <main>
            <h1>
                Synchronisatie-rapport
            </h1>

            <div class="error-box-parent" v-for="error in report.errors">
                <div class="error-box" @click="handleError(error)" :class="{ selectable: canClickError(error)}">
                    <h2 class="style-title-list" v-if="error.member">{{ error.member.firstName }} {{ error.member.lastName || error.member.details.lastName }}<span class="icon arrow-right-small" v-if="canClickError(error)"/></h2>
                    {{ error.human || error.message }}

                    
                </div>
            </div>

            <div class="warning-box" v-for="warning in report.warnings">
                {{ warning }}
            </div>
        
            <hr>
            <h2>Nieuwe leden toegevoegd in de groepsadministratie</h2>
            <STList>
                <STListItem v-for="member in report.created" :key="member.id">
                    <div>
                        <h2 class="style-title-list">{{ member.details.firstName }} {{ member.details.lastName }}</h2>
                        <p class="style-description-small">{{ member.details.birthDay | date }}</p>
                    </div>
                </STListItem>
            </STList>

            <hr>
            <h2>Aangepaste leden in de groepsadministratie</h2>
            <STList>
                <STListItem v-for="member in report.synced" :key="member.id">
                    <div>
                        <h2 class="style-title-list">{{ member.details.firstName }} {{ member.details.lastName }}</h2>
                        <p class="style-description-small">{{ member.details.birthDay | date }}</p>
                    </div>
                </STListItem>
            </STList>

            <hr>
            <h2>Geschrapt in de groepsadministratie</h2>
            <STList>
                <STListItem v-for="member in report.deleted" :key="member.id">
                    <div>
                        <h2 class="style-title-list">{{ member.firstName }} {{ member.lastName }}</h2>
                        <p class="style-description-small">{{ member.birthDay | date }}</p>
                    </div>
                </STListItem>
            </STList>

            <hr>
            <h2>Geïmporteerd in Stamhoofd</h2>
            <STList>
                <STListItem v-for="member in report.imported" :key="member.id">
                    <div>
                        <h2 class="style-title-list">{{ member.details.firstName }} {{ member.details.lastName }}</h2>
                        <p class="style-description-small">{{ member.details.birthDay | date }}</p>
                    </div>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="goNext">
                        Sluiten
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, ArrayDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, Checkbox,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, LoadingButton, Validator, STList, STListItem} from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationDomains, DNSRecord, MemberWithRegistrations } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DNSRecordsView from './DNSRecordsView.vue';
import { SGVLid, SGVLidMatch, SGVLidMatchVerify } from '../../../classes/SGVGroepsadministratie';
import { Formatter } from '@stamhoofd/utility';
import { SGVSyncReport } from '../../../classes/SGVGroepsadministratieSync';
import MemberView from '../member/MemberView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STList,
        STListItem,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
    filters: {
        date: Formatter.date.bind(Formatter)
    }
})
export default class SGVReportView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ required: true })
    report: SGVSyncReport

    async goNext() {
        if (this.loading) {
            return;
        }

        this.dismiss({ force: true })
    }

    canClickError(error) {
        return (error.member && error.member.details)
    }

    handleError(error) {
        if (error.member && error.member.details) {
            this.present(new ComponentWithProperties(MemberView, { member: error.member }).setDisplayStyle("popup"))
        }
    } 
}

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
