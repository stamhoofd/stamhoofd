<template>
    <div class="st-view" id="sgv-old-members-view">
        <STNavigationBar title="Importeren of schrappen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button icon close gray" v-if="canDismiss" @click="dismiss"/>
        </STNavigationBar>

        <main>
            <h1>
                Wil je deze leden importeren in Stamhoofd of schrappen in de Groepsadministratie?
            </h1>
            <p>Er staan leden in de Groepsadministratie die nog niet in Stamhoofd staan. Je kan deze importeren, ofwel schrappen in de groepsadministratie (omdat ze gestopt zijn).</p>
        
            <STList>
                <STListItem v-for="member in members" :key="member.id">
                    <div>
                        <h2 class="style-title-list">{{ member.firstName }} {{ member.lastName }}</h2>
                        <p class="style-description-small">{{ member.birthDay | date }}</p>
                    </div>
                </STListItem>

            </STList>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button destructive" @click="doDelete">
                    <span class="icon trash"/><span>Schrappen</span>
                </button>
                <button class="button secundary" @click="doImport">
                    <span class="icon download"/><span>Importeren</span>
                </button>
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="doNothing">
                        Behouden
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

    async doImport() {
        if (this.loading) {
            return;
        }
        this.didSetAction = true;
        this.dismiss({ force: true })
        this.setAction("import")
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
