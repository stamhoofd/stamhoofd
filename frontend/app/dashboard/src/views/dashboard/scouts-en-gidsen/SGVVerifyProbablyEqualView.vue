<template>
    <div id="sgv-probably-equal-view" class="st-view">
        <STNavigationBar title="Lijken op elkaar" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Vink de rijen uit als het om verschillende personen gaat
            </h1>
            <p>We zijn niet 100% zeker dat deze leden uit Stamhoofd in de Groepsadministratie op dezelfde persoon duiden (bv. door een typfout of een vergissing in de geboortedatum of geslacht). Kan je dit manueel verifiëren?</p>
        
            <STList>
                <STListItem v-for="match in matches" :key="match.stamhoofd.id" element-name="label" :selectable="true">
                    <template #left><div>
                        <h2 class="style-title-list">
                            {{ match.stamhoofd.details.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ match.stamhoofd.details.birthDayFormatted || "/" }}
                        </p>
                    </div></template>

                    <div>
                        <h2 class="style-title-list">
                            {{ match.sgv.firstName }} {{ match.sgv.lastName }}
                        </h2>
                        <p class="style-description-small">
                            {{ formatDate(match.sgv.birthDay) }}
                        </p>
                    </div>

                    <Checkbox #right v-model="match.verify" />
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click.prevent.stop="cancel">
                    <span>Annuleren</span>
                </button>
                <button class="button primary" type="button" @click.prevent.stop="goNext">
                    Verder
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingButton, STErrorsDefault,STInputBox, STList, STListItem,STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { SGVLidMatchVerify } from '../../../classes/SGVStructures';

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

    @Prop({ required: true })
    onVerified: (verified: SGVLidMatchVerify[]) => void

    @Prop({ required: true })
    onCancel: () => void

    beforeUnmount() {
        if (!this.didVerify) {
            this.didVerify = true;
            this.onCancel()
        }
    }

    cancel() {
        if (this.didVerify) {
            return;
        }
        
        this.dismiss({force: true})
    }
    
    goNext() {
        if (this.loading || this.didVerify) {
            return;
        }
        this.didVerify = true;
        this.dismiss({ force: true })

        setTimeout(() => {
            this.onVerified(this.matches)
        }, 200);
    }
}

</script>