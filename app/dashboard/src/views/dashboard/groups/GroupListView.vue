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
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" class="right-stack right-description" @click="editGroup(group)">
                    {{ group.settings.name }}
                    <template slot="right">
                        {{ groupDescription(group) }}
                        <MaleIcon v-if="group.settings.genderType == 'OnlyMale'" />
                        <FemaleIcon v-if="group.settings.genderType == 'OnlyFemale'" />
                        <span class="icon gray arrow-right-small" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, MaleIcon, FemaleIcon } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings, OrganizationPatch } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import GroupEditView from './GroupEditView.vue';
import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        MaleIcon,
        FemaleIcon
    }
})
export default class GroupListView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive

    get organization() {
        return OrganizationManager.organization
    }

    get groups() {
        return this.organization.groups
    }

    createGroup() {
        const group = Group.create({
            settings: GroupSettings.create({
                name: "",
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                genderType: this.organization.meta.genderType == OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale
            })
        })

        const organizationPatch = OrganizationPatch.create({
            id: this.organization.id,
        })
        organizationPatch.groups.addPut(group)
        this.present(new ComponentWithProperties(GroupEditView, { groupId: group.id, organizationPatch }).setDisplayStyle("popup"))
    }

    editGroup(group: Group) {
        const organizationPatch = OrganizationPatch.create({
            id: this.organization.id,
        })
        this.present(new ComponentWithProperties(GroupEditView, { groupId: group.id, organizationPatch }).setDisplayStyle("popup"))
    }

    groupDescription(group: Group) {
        if (group.settings.minBirthYear && group.settings.maxBirthYear) {
            const startYear = new Date().getFullYear() - group.settings.maxBirthYear
            const endYear = new Date().getFullYear() - group.settings.minBirthYear
            return startYear + " - "+endYear+" jaar"
        }
        return ""
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
