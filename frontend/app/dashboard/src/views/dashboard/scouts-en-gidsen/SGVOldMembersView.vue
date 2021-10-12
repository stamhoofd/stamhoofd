<template>
    <div id="sgv-old-members-view" class="st-view">
        <STNavigationBar title="Schrappen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="canDismiss" slot="right" class="button icon close gray" type="button" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>
                Wil je deze leden schrappen in de groepsadministratie?
            </h1>
            <p>Er staan leden in de groepsadministratie die nog niet in Stamhoofd staan. Je kan deze schrappen (bv. omdat ze gestopt zijn) of behouden (bv. omdat je ze nog even tijd wilt geven om opnieuw in te schrijven). Je schrapt leden best pas net voor de deadline van 15 oktober en daarna, zo blijven ze nog even verzekerd als de inschrijving niet meteen in orde is.</p>
        
            <STList>
                <STListItem v-for="member in members" :key="member.id">
                    <div>
                        <h2 class="style-title-list">
                            {{ member.firstName }} {{ member.lastName }}
                        </h2>
                        <p class="style-description-small">
                            {{ member.birthDay | date }}
                        </p>
                    </div>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button destructive" type="button" @click="doDelete">
                    <span class="icon trash" /><span>Schrappen</span>
                </button>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="doNothing">
                        Behouden
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,LoadingButton, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar} from "@stamhoofd/components";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { SGVLid } from '../../../classes/SGVGroepsadministratie';

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
export default class SGVOldMembersView extends Mixins(NavigationMixin) {
    loading = false
    didSetAction = false

    @Prop({ required: true })
    members: SGVLid[]

    @Prop({ required: true })
    setAction: (action: "delete" | "import" | "nothing") => void;

    @Prop({ required: true })
    onCancel: () => void

    beforeDestroy() {
        if (!this.didSetAction) {
            this.onCancel()
        }
    }

    
    async doDelete() {
        if (this.loading) {
            return;
        }
        this.didSetAction = true;
        this.dismiss({ force: true })
        this.setAction("delete")
    }

    async doNothing() {
        if (this.loading) {
            return;
        }
        this.didSetAction = true;
        this.dismiss({ force: true })
        this.setAction("nothing")
    }
}

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
