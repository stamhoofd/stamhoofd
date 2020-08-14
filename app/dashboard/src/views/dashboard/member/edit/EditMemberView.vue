<template>
    <div class="st-view edit-member-view">
        <STNavigationBar :title="member.details.name">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon gray close" @click="pop"></button>
        </STNavigationBar>
        <STNavigationTitle>
            Wijzig gegevens van {{ member.details.firstName }}
        </STNavigationTitle>

        <SegmentedControl v-model="changeTab" :items="tabs" :labels="tabLabels"/>

        <main>
            <component :is="tab" v-model="memberDetails" :member="member" :family-manager="familyManager" ref="currentComponent"/>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationTitle, ErrorBox } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, SegmentedControl, STToolbar, LoadingButton } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MemberContextMenu from "./MemberContextMenu.vue";
import MemberViewDetails from "./MemberViewDetails.vue";
import MemberViewHistory from "./MemberViewHistory.vue";
import MemberViewPayments from "./MemberViewPayments.vue";
import { MemberWithRegistrations, Gender, MemberDetails } from '@stamhoofd/structures';
import EditMemberGeneralView from './EditMemberGeneralView.vue';
import EditMemberContactsView from './EditMemberContactsView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import { FamilyManager } from "../../../../classes/FamilyManager";
import EditMemberRecordsView from './EditMemberRecordsView.vue';

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        BackButton,
        STToolbar,
        LoadingButton
    },
})
export default class EditMemberView extends Mixins(NavigationMixin) {
    tabs = [EditMemberGeneralView, EditMemberContactsView, EditMemberRecordsView];
    tabLabels = ["Algemeen", "Contacten", "Steekkaart"];
    loading = false

    @Prop()
    member!: MemberWithRegistrations;

    @Prop({ default: null })
    initialTabIndex: number | null

    tab: any = this.tabs[this.initialTabIndex ?? 0];

    familyManager = new FamilyManager([this.member]);

    memberDetails = this.member.details // do not link with member, only link on save!

    get changeTab() {
        return this.tab
    }

    set changeTab(tab: any) {
        (this.$refs.currentComponent as any).validate().then((isValid) => {
            if (isValid) {
                this.tab = tab
            }
        })
    }

    get currentComponent() {
        return (this.$refs.currentComponent as any)
    }

    async save() {
        if (this.loading) {
            return;
        }
        if (!this.memberDetails) {
            return false;
        }
        const isValid = await (this.$refs.currentComponent as any).validate()
        if (!isValid) {
            return;
        }

        const o = this.memberDetails
        this.loading = true
        
        try {
            this.member.details = this.memberDetails

            console.log(this.memberDetails)
            await this.familyManager.patchAllMembersWith(this.member)

            this.currentComponent.errorBox = null
            this.loading = false;

            this.pop({ force: true })
            return true
        } catch (e) {
            this.member.details = o
            this.currentComponent.errorBox = new ErrorBox(e)
            this.loading = false;
            return false;
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.edit-member-view {
    > main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        padding-top: 20px;
    }
}
</style>
