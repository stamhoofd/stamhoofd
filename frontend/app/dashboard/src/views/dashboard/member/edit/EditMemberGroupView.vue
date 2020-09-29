<template>
    <div id="parent-view" class="st-view">
        <STNavigationBar title="Kies een groep">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon gray close" @click="pop"></button>
        </STNavigationBar>
        
        <main>
            <h1>
                Kies een groep
            </h1>

            <STErrorsDefault :error-box="errorBox" />

             <STList>
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center">
                    <Radio slot="left" name="choose-group" v-model="selectedGroup" :value="group"/>
                    <h2 class="style-title-list">{{ group.settings.name }}</h2>
                    <p class="style-description-small" v-if="group.settings.description">{{ group.settings.description }}</p>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, AddressInput, Radio, PhoneInput, Checkbox, Validator, STList, STListItem, EmailInput, BackButton, LoadingButton, Toast } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent, ParentType, ParentTypeHelper, Group } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import MemberParentsView from './MemberParentsView.vue';
import { FamilyManager } from '../../../../classes/FamilyManager';
import { MemberWithRegistrations } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../classes/OrganizationManager';
import { Registration } from '@stamhoofd/structures';
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        Radio,
        PhoneInput,
        EmailInput,
        Checkbox,
        STList,
        STListItem,
        BackButton,
        LoadingButton
    }
})
export default class EditMemberGroupView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    memberDetails: MemberDetails

    @Prop({ default: null })
    member: MemberWithRegistrations | null

    @Prop({ required: true })
    familyManager: FamilyManager

    // Fow now we only allow to select one group
    selectedGroup: Group | null = null
    groups: Group[] = []

    errorBox: ErrorBox | null = null
    loading = false
    validator = new Validator()

    mounted() {
        this.groups = OrganizationManager.organization.groups

        if (this.member && this.member.activeRegistrations.length > 0) {
            this.selectedGroup = this.groups.find(g => g.id == this.member!.activeRegistrations[0].groupId) ?? null
        } else {
            this.selectedGroup = this.memberDetails.getMatchingGroups(this.groups)[0] ?? null
        }
    }

    async save() {
        if (this.loading) {
            return;
        }
        if (!this.memberDetails) {
            return false;
        }
        if (!this.selectedGroup) {
            return false;
        }

        this.loading = true
        
        try {
            if (this.member) {
                // Get an active registration
                const notChanged = !!this.member.activeRegistrations.find(r => r.groupId == this.selectedGroup!.id)
                if (notChanged) {
                     this.loading = false;
                    this.dismiss({ force: true })
                    return true;
                }

                const patchRegistrations: PatchableArrayAutoEncoder<Registration> = new PatchableArray()

                const moveRegistration = this.member.activeRegistrations[0]
                if (!moveRegistration) {
                    patchRegistrations.addPut(
                        Registration.create({
                            groupId: this.selectedGroup.id,
                            cycle: this.selectedGroup.cycle,
                            waitingList: false,
                            payment: null,
                            registeredAt: new Date()
                        })
                    )
                } else {
                    patchRegistrations.addPatch(Registration.patch({
                        id: moveRegistration.id,
                        groupId: this.selectedGroup.id,
                        cycle: this.selectedGroup.cycle,
                    }))
                }

                await this.familyManager.patchMemberRegistrations(this.member, patchRegistrations);
                new Toast("De leeftijdsgroep van "+this.memberDetails.firstName+" is gewijzigd", "success green").show()
            } else {
                await this.familyManager.addMember(this.memberDetails, [
                    Registration.create({
                        groupId: this.selectedGroup.id,
                        cycle: this.selectedGroup.cycle,
                        waitingList: false,
                        payment: null,
                        registeredAt: new Date()
                    })
                ])
                new Toast(this.memberDetails.firstName+' is toegevoegd', "success green").show()
            }
          
            this.errorBox = null
            this.loading = false;
            this.dismiss({ force: true })
            return true
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            this.loading = false;
            return false;
        }
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;


</style>
