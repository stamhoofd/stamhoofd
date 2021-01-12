<template>
    <div id="sgv-probably-equal-view" class="st-view">
        <STNavigationBar title="Lijken op elkaar">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>
                Vink de rijen uit als het om verschillende personen gaat
            </h1>
            <p>We zijn niet 100% zeker dat deze leden uit Stamhoofd in de Groepsadministratie op dezelfde persoon duiden (bv. door een typfout of een vergissing in de geboortedatum of geslacht). Kan je dit manueel verifiëren?</p>
        
            <STList>
                <STListItem v-for="match in verifiedMatches" :key="match.stamhoofd.id" element-name="label" :selectable="true">
                    <div slot="left">
                        <h2 class="style-title-list">
                            {{ match.stamhoofd.details.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ match.stamhoofd.details.birthDayFormatted || "/" }}
                        </p>
                    </div>

                    <div>
                        <h2 class="style-title-list">
                            {{ match.sgv.firstName }} {{ match.sgv.lastName }}
                        </h2>
                        <p class="style-description-small">
                            {{ match.sgv.birthDay | date }}
                        </p>
                    </div>

                    <Checkbox slot="right" v-model="match.verify" />
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingButton, STErrorsDefault,STInputBox, STList, STListItem,STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { SGVLidMatchVerify } from '../../../classes/SGVGroepsadministratie';

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
    didVerify = false

    @Prop({ required: true })
    matches: SGVLidMatchVerify[]

    verifiedMatches: SGVLidMatchVerify[] = []

    @Prop({ required: true })
    onVerified: (verified: SGVLidMatchVerify[]) => void

    @Prop({ required: true })
    onCancel: () => void

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

    beforeDestroy() {
        if (!this.didVerify) {
            this.onCancel()
        }
    }
    
    goNext() {
        if (this.loading) {
            return;
        }
        this.didVerify = true;

        this.dismiss({ force: true })
        this.onVerified(this.verifiedMatches)
    }
}

</script>