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
            <h1>Nog iemand inschrijven?</h1>
            <p>Voeg eventueel nog andere broers of zussen toe voor je doorgaat naar betalen.</p>

            <STList>
                <STListItem v-for="member in members" :key="member.id" :selectable="true" class="right-stack">
                    <Checkbox slot="left" />
                    {{ member.details.name }}
                    <template slot="right">
                        <span class="icon gray arrow-right-small" />
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <button slot="right" class="button primary" @click="addNewMember"><span class="icon white add"/>Nog iemand inschrijven</button>
            <button slot="right" class="button secundary"><span class="icon white arrow-right"/>Doorgaan naar betalen</button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';

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

    addNewMember() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {})
        }).setDisplayStyle("popup"))
    }
}
</script>