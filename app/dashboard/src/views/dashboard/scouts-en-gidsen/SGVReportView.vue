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
        
            <hr>
            <h2>Nieuwe leden toegevoegd in de groepsadministratie</h2>
            <STList>
                <STListItem v-for="member in createdMembers" :key="member.id">
                    <div>
                        <h2 class="style-title-list">{{ member.details.firstName }} {{ member.details.lastName }}</h2>
                        <p class="style-description-small">{{ member.details.birthDay | date }}</p>
                    </div>
                </STListItem>
            </STList>

            <hr>
            <h2>Aangepaste leden in de groepsadministratie</h2>
            <STList>
                <STListItem v-for="member in updatedMembers" :key="member.id">
                    <div>
                        <h2 class="style-title-list">{{ member.details.firstName }} {{ member.details.lastName }}</h2>
                        <p class="style-description-small">{{ member.details.birthDay | date }}</p>
                    </div>
                </STListItem>
            </STList>

            <hr>
            <h2>Geschrapt in de groepsadministratie</h2>
            <STList>
                <STListItem v-for="member in deletedMembers" :key="member.id">
                    <div>
                        <h2 class="style-title-list">{{ member.firstName }} {{ member.lastName }}</h2>
                        <p class="style-description-small">{{ member.birthDay | date }}</p>
                    </div>
                </STListItem>
            </STList>

            <hr>
            <h2>Geïmporteerd in Stamhoofd</h2>
            <STList>
                <STListItem v-for="member in importedMembers" :key="member.id">
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
    createdMembers: MemberWithRegistrations[]

    @Prop({ required: true })
    updatedMembers: MemberWithRegistrations[]

    @Prop({ required: true })
    deletedMembers: SGVLid[]

    @Prop({ required: true })
    importedMembers: MemberWithRegistrations[]

    async goNext() {
        if (this.loading) {
            return;
        }

        this.dismiss({ force: true })
    }
}

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
