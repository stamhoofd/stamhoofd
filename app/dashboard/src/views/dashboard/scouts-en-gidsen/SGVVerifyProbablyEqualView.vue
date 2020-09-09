<template>
    <div class="st-view" id="sgv-probably-equal-view">
        <STNavigationBar title="Lijken op elkaar">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button icon close gray" v-if="canDismiss" @click="dismiss"/>
        </STNavigationBar>

        <main>
            <h1>
                Vink de rijen uit als het om verschillende personen gaat
            </h1>
            <p>We zijn niet 100% zeker dat deze leden uit Stamhoofd in de Groepsadministratie op dezelfde persoon duiden (bv. door een typfout of een vergissing in de geboortedatum of geslacht). Kan je dit manueel verifiëren?</p>
        
            <STList>
                <STListItem v-for="match in verifiedMatches" element-name="label" :selectable="true" :key="match.stamhoofd.id">
                    <div slot="left">
                        <h2 class="style-title-list">{{ match.stamhoofd.details.name }}</h2>
                        <p class="style-description-small">{{ match.stamhoofd.details.birthDay | date }}</p>
                    </div>

                    <div>
                        <h2 class="style-title-list">{{ match.sgv.firstName }} {{ match.sgv.lastName }}</h2>
                        <p class="style-description-small">{{ match.sgv.birthDay | date }}</p>
                    </div>

                    <Checkbox slot="right" v-model="match.verify"/>
                </STListItem>

            </STList>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary">
                    <span>Annuleren</span>
                </button>
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="goNext">
                        Verder
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
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationDomains, DNSRecord } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DNSRecordsView from './DNSRecordsView.vue';
import { SGVLidMatch, SGVLidMatchVerify } from '../../../classes/SGVGroepsadministratie';
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
export default class SGVVerifyProbablyEqualView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ required: true })
    matches: SGVLidMatchVerify[]

    verifiedMatches: SGVLidMatchVerify[] = []

    @Prop({ required: true })
    onVerified: (verified: SGVLidMatchVerify[]) => void

    mounted() {
        // clone
        this.verifiedMatches = this.matches.map(m => {
            return {
                sgv: m.sgv,
                stamhoofd: m.stamhoofd,
                verify: m.verify
            }
        })
    }
     
    
    async goNext() {
        if (this.loading) {
            return;
        }

        this.dismiss({ force: true })
        this.onVerified(this.verifiedMatches)
    }
}

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
