<template>
    <div class="st-view group-list-view">
        <STNavigationBar :sticky="false">
            <template #left>
                <button v-if="canPop" class="button icon gray left arrow-left" @click="pop">
                    Terug
                </button>
            </template>
            <template #right>
                <button class="button icon gray left add" @click="createGroup">
                    Nieuw
                </button>
            </template>
        </STNavigationBar>

    
        <main>
            <h1>Groepen</h1>
            <p>Hier kan je de groepen binnen jouw vereniging beheren en bewerken. Je kan instellen wie zich kan inschrijven bij welke groepen op basis van leeftijd en geslacht. Als op basis van deze restricties, leden toch in meerdere groepen passen, dan krijgen ze de keuze tijdens het inschrijven. Je kan deze daarna nog goedkeuren of verplaatsen</p>
            <STList>
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" class="right-stack right-description">
                    {{ group.settings.name }}
                    <template slot="right">
                        16 jaar
                        <span class="icon gray arrow-right-small" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import GroupEditView from './GroupEditView.vue';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem
    }
})
export default class GroupListView extends Mixins(NavigationMixin) {
    organization = SessionManager.currentSession!.organization!
    groups = SessionManager.currentSession!.organization!.groups

    createGroup() {
        const group = Group.create({
            settings: GroupSettings.create({
                name: "Naamloos",
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                genderType: this.organization.meta.genderType == OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale
            })
        })
        this.present(new ComponentWithProperties(GroupEditView, { group }).setDisplayStyle("popup"))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.group-list-view {
    background: $color-white;
}
</style>
