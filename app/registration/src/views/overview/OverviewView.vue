<template>
    <LoadingView v-if="members === null" />
    <div class="st-view auto" v-else-if="members.length == 0">
        <main>
            <h1>Je hebt nog niemand ingeschreven</h1>
            <p>Je hebt nog niemand ingeschreven voor dit werkjaar. Begin met iemand in te schrijven.</p>
        </main>
        <STToolbar>
            <button class="primary button" slot="right" @click="addNewMember">
                <span class="icon white left add"/>
                <span>Lid inschrijven</span>
            </button>
        </STToolbar>
    </div>
    <div class="st-view auto" v-else>
        <main>
            <h1>Wie wil je inschrijven?</h1>

            <p>Voeg eventueel broers en zussen toe zodat we ze in één keer kunnen afrekenen</p>

            <STList class="member-selection-table">
                <STListItem v-for="member in members" :key="member.id" :selectable="true" class="right-stack left-center" >
                    <Checkbox v-model="memberSelection[member.id]" slot="left" @click.native.stop @change="onSelectMember(member)" />
                    <p>{{ member.details.name }}</p>
                    <p class="member-group" v-if="memberGetGroup(member)">Inschrijven bij {{ memberGetGroup(member).settings.name }}</p>
                    <p class="member-group" v-else>Kies eerst een groep</p>

                    <template slot="right">
                        <button class="button text" @click.stop="editMember(member)">
                            <span class="icon edit" />
                            <span>Bewerken</span>
                        </button>
                        
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <button slot="right" class="button primary" @click="addNewMember">
                <span class="icon add"/>
                <span>Nog iemand toevoegen</span>
            </button>
            <button slot="right" class="button secundary">
                <span>Inschrijven</span>
                <span class="icon gray arrow-right"/>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { DecryptedMember, Group } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';

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
    memberSelection: { [key:string]:boolean; } = {}

    get members() {
        if (MemberManager.members) {
            for (const member of MemberManager.members) {
                if (this.memberSelection[member.id] === undefined) {
                    // if the member doesn't have any registrations, we select it by default
                    if (member.registrations.length == 0 && this.memberGetGroup(member) !== null) {
                        this.$set(this.memberSelection, member.id, true)
                    } else {
                        this.$set(this.memberSelection, member.id, false)
                    }
                }
            }
        }
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
        if (this.memberSelection[member.id] === false) {
            return;
        }
        if (this.memberGetGroup(member) === null) {
            // Disable select until group is chosen
            this.$nextTick(() => {
                this.memberSelection[member.id] = false;
                console.log(this.memberSelection)
            })

            this.present(new ComponentWithProperties(MemberGroupView, {
                memberDetails: member.details,
                handler: (group: Group, component: MemberGroupView) => {
                    if (!member.details) {
                        console.error("Member details suddenly gone")
                        return
                    }
                    
                    component.loading = true;

                    member.details.preferredGroupId = group.id

                    MemberManager.patchMembers([
                        member
                    ]).then(() => {
                        component.pop()
                        this.memberSelection[member.id] = true;
                    }).catch(e => {
                        console.error(e)
                        component.loading = false
                        component.errorBox = new ErrorBox(new SimpleError({
                            code: "",
                            message: "Er ging iets mis"
                        }))
                    })
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

    editMember(member: DecryptedMember) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {
                member
            })
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