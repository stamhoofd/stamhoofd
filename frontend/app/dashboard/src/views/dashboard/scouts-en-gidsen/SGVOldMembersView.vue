<template>
    <div class="st-view">
        <STNavigationBar title="Schrappen" :dismiss="canDismiss" :pop="canPop" />

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
                            {{ formatDate(member.birthDay) }}
                        </p>
                    </div>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button destructive" type="button" @click.prevent.stop="doDelete">
                    <span class="icon trash" /><span>Schrappen</span>
                </button>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click.prevent.stop="doNothing">
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
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

import { SGVLid } from '../../../classes/SGVStructures';

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

    beforeUnmount() {
        if (!this.didSetAction) {
            this.onCancel()
        }
    }
    
    doDelete() {
        if (this.didSetAction) {
            return;
        }
        this.didSetAction = true;
        this.dismiss({ force: true })
        setTimeout(() => {
            this.setAction("delete") 
        }, 200)
    }

    doNothing() {
        if (this.didSetAction) {
            return;
        }
        this.didSetAction = true;
        this.dismiss({ force: true })
        setTimeout(() => {
            this.setAction("nothing")
        }, 200)
    }
}

</script>