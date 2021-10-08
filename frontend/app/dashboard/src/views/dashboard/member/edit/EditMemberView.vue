<template>
    <div class="st-view edit-member-view">
        <STNavigationBar :title="member ? member.details.name : 'Nieuw lid'">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon gray close" @click="pop" />
        </STNavigationBar>
        
        <main>
            <h1 v-if="member">
                Wijzig gegevens van {{ member.details.firstName }}
            </h1>
            <h1 v-else>
                Nieuw lid toevoegen
            </h1>

            <STErrorsDefault :error-box="errorBox" />
            <EditMemberGeneralView v-model="memberDetails" :member="member" :family-manager="familyManager" :validator="validator" />

            <EditMemberContactsView v-model="memberDetails" :member="member" :family-manager="familyManager" :validator="validator" />
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
import { ErrorBox,STErrorsDefault,STNavigationTitle, Validator } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, LoadingButton,SegmentedControl, STToolbar } from "@stamhoofd/components";
import { MemberDetails, MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from "../../../../classes/FamilyManager";
import EditMemberContactsView from './EditMemberContactsView.vue';
import EditMemberGeneralView from './EditMemberGeneralView.vue';
import EditMemberGroupView from './EditMemberGroupView.vue';

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        BackButton,
        STToolbar,
        LoadingButton,
        EditMemberGeneralView,
        EditMemberContactsView,
        STErrorsDefault
    },
})
export default class EditMemberView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ default: null })
    initialFamily!: FamilyManager | null;

    @Prop({ default: null })
    member!: MemberWithRegistrations | null;

    familyManager = this.initialFamily ?? new FamilyManager(this.member ? [this.member] : []);

    memberDetails = this.member ? this.member.details : MemberDetails.create({})// do not link with member, only link on save!

    validator = new Validator()

    errorBox: ErrorBox | null = null

    async save() {
        if (this.loading) {
            return;
        }
        
        const isValid = await this.validator.validate()
        if (!isValid) {
            return;
        }

        if (!this.memberDetails) {
            return false;
        }

        if (!this.member) {
            this.show(new ComponentWithProperties(EditMemberGroupView, {
                memberDetails: this.memberDetails,
                familyManager: this.familyManager,
            }))
            return;
        }

        const o = this.member?.details
        this.loading = true
        
        try {
            if (this.member) {
                this.member.details = this.memberDetails
                await this.familyManager.patchAllMembersWith(this.member)
            }
          
            this.errorBox = null
            this.loading = false;
            this.pop({ force: true })
            return true
        } catch (e) {
            if (this.member && o) {
                this.member.details = o
            }
            this.errorBox = new ErrorBox(e)
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
    }
}
</style>
