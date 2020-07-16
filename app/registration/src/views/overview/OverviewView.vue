<template>
    <LoadingView v-if="members === null" />
    <div class="st-view auto" v-else-if="members.length == 0">
        <main>
            <h1>Je hebt nog niemand ingeschreven</h1>
            <p>Je hebt nog niemand ingeschreven voor dit werkjaar. Begin met iemand in te schrijven.</p>
        </main>
        <STToolbar>
            <button class="primary button add" slot="right" @click="addNewMember">
                <span class="icon white add"/>
                Lid inschrijven
            </button>
        </STToolbar>
    </div>
    <div class="st-view auto" v-else>
        <main>
            <h1>Wie wil je inschrijven?</h1>

            <p>Voeg eventueel broers en zussen toe zodat we ze in één keer kunnen afrekenen</p>

            <STList class="member-selection-table">
                <STListItem v-for="member in members" :key="member.id" :selectable="true" class="right-stack left-center" @click="onSelectMember(member)">
                    <Checkbox slot="left" />
                    <p>{{ member.details.name }}</p>
                    <p class="member-group" v-if="memberGetGroup(member)">Inschrijven bij {{ memberGetGroup(member).settings.name }}</p>
                    <p class="member-group" v-else>Kies eerst een groep</p>

                    <template slot="right">
                        <span class="icon gray arrow-right-small" />
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <button slot="right" class="button primary" @click="addNewMember"><span class="icon white add"/>Nog iemand toevoegen</button>
            <button slot="right" class="button secundary">Inschrijven<span class="icon gray arrow-right"/></button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { DecryptedMember, Group } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
    }
})
export default class OverviewView extends Mixins(NavigationMixin){
    MemberManager = MemberManager

    get members() {
        return MemberManager.members
    }

    mounted() {
        MemberManager.loadMembers().catch(e => {
            console.error(e)
        })
    }

    onSelectMember(member: DecryptedMember) {
        if (!member.details) {
            return
        }
        if (this.memberGetGroup(member) === null) {
            this.present(new ComponentWithProperties(MemberGroupView, {
                member: member.details,
                handler: () => {

                }
            }).setDisplayStyle("popup"))
        }
    }

    memberGetGroup(member: DecryptedMember): Group | null {
        if (!member.details) {
            return null
        }

        const groups = OrganizationManager.organization.groups
        if (member.details.preferredGroupId) {
            for (const group of groups) {
                if (group.id === member.details.preferredGroupId) {
                    return group
                }
            }
        }

        // Search for possibilities
        const matching = member.details.getMatchingGroups(groups)
        if (matching.length == 1) {
            return matching[0]
        }
        return null
    }

    addNewMember() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {})
        }).setDisplayStyle("popup"))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.member-selection-table {
    .member-group {
        @extend .style-description-small;
        margin-top: 5px;
        line-height: 1; // to fix alignment
    }
}
</style>