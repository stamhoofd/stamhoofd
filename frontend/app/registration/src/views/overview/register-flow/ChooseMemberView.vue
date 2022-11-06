<template>
    <div class="st-view background">
        <STNavigationBar title="Wie wil je inschrijven?" :pop="canPop" :dismiss="canDismiss" />

        <main>
            <h1>Wie wil je inschrijven?</h1>

            <STList class="illustration-list">
                <STListItem v-for="member in members" :key="member.id" class="right-stack" :selectable="true" @click.stop="selectMember(member)">
                    <img v-if="member.details.gender === 'Female'" slot="left" src="~@stamhoofd/assets/images/illustrations/member-female.svg">
                    <img v-else slot="left" src="~@stamhoofd/assets/images/illustrations/member-male.svg">

                    <h2 class="style-title-list">
                        {{ member.firstName }} {{ member.details ? member.details.lastName : "" }}
                    </h2>

                    <template slot="right">
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="isAcceptingNewMembers" class="right-stack" :selectable="true" @click="addNewMember">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/account-add.svg">

                    <h2 class="style-title-list">
                        Nieuw lid toevoegen
                    </h2>

                    <template slot="right">
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, OrganizationLogo, STList, STListItem, STNavigationBar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { MemberWithRegistrations } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from "../../../classes/MemberManager";
import { OrganizationManager } from "../../../classes/OrganizationManager";
import { createMemberComponent } from "../../members/details/createMemberComponent";
import MemberChooseGroupsView from "../../members/MemberChooseGroupsView.vue";

@Component({
    components: {
        STNavigationBar,
        OrganizationLogo,
        STList,
        STListItem,
        BackButton
    }
})
export default class ChooseMemberView extends Mixins(NavigationMixin){
    MemberManager = MemberManager

    get isAcceptingNewMembers() {
        return this.organization.isAcceptingNewMembers(!!SessionManager.currentSession?.user?.permissions)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get members() {
        if (MemberManager.members) {
            return MemberManager.members
        }
        return []
    }

    selectMember(member: MemberWithRegistrations) {
        this.show(new ComponentWithProperties(MemberChooseGroupsView, {
            member
        }))
    }

    async addNewMember() {
        const component = await createMemberComponent()
        if (component) {
            this.show(component)
        }
    }
}
</script>