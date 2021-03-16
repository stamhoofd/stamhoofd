<template>
    <div class="st-view group-view">
        <STNavigationBar title="Inschrijven">
            <template slot="left">
                <BackButton v-if="canPop" @click="pop" />
                <button v-else slot="right" class="button icon gray close" @click="pop" />
            </template>
        </STNavigationBar>
        
        <main>
            <h1>Wie wil je inschrijven voor "{{ group.settings.name }}"?</h1>

            <p v-if="members.length === 0" class="info-box">
                Je hebt nog geen leden aan jouw account toegevoegd. Voeg eerst een lid toe voor je ergens inschrijft.
            </p>
            <p class="info-box">
                Geen leden uit jouw account kunnen hiervoor inschrijven (zie onder). Voeg eventueel een nieuw lid toe.
            </p>

            <STList>
                <MemberBox v-for="member in members" :key="member.id" :group="group" :member="member" />
            </STList>
        </main>

        <STToolbar>
            <button slot="right" class="secundary button">
                <span class="icon add" />
                <span>Nieuw lid toevoegen</span>
            </button>
            <button slot="right" class="primary button" @click="goToBasket">
                <span>Doorgaan</span>
                <span class="icon arrow-right" />
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Group } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from "../../classes/MemberManager";
import MemberBox from "../../components/MemberBox.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        MemberBox
    },
    filters: {
        price: Formatter.price
    }
})
export default class GroupMemberSelectionView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    group!: Group

    MemberManager = MemberManager

    get members() {
        return this.MemberManager.members ?? []
    }

    get closed() {
        return this.group.closed
    }

    goToBasket() {
        this.dismiss({ force: true })
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-view {
}
</style>