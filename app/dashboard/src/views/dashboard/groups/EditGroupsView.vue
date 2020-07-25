<template>
    <div class="st-view group-list-view">
        <STNavigationBar :sticky="false">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button text" @click="createGroup">
                <span class="icon add"/>
                <span>Nieuw</span>
            </button>
        </STNavigationBar>

    
        <main>
            <h1>Groepen</h1>
            <p>Hier kan je de groepen binnen jouw vereniging beheren en bewerken. Je kan instellen wie zich kan inschrijven bij welke groepen op basis van leeftijd en geslacht. Als op basis van deze restricties, leden toch in meerdere groepen passen, dan krijgen ze de keuze tijdens het inschrijven. Je kan deze daarna nog goedkeuren of verplaatsen</p>
            <STList>
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" class="right-stack right-description" @click="editGroup(group)">
                    {{ group.settings.name }}
                    <template slot="right">
                        <span>{{ groupDescription(group) }}</span>
                        <MaleIcon v-if="group.settings.genderType == 'OnlyMale'" />
                        <FemaleIcon v-if="group.settings.genderType == 'OnlyFemale'" />
                        <button class="button icon gray trash" @click.stop="deleteGroup(group)"/>
                        <span class="icon gray arrow-right-small" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, MaleIcon, FemaleIcon, CenteredMessage, BackButton } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings, OrganizationPatch } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditGroupView from './EditGroupView.vue';
import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        MaleIcon,
        FemaleIcon,
        BackButton
    }
})
export default class EditGroupsView extends Mixins(NavigationMixin) {
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
        this.present(new ComponentWithProperties(EditGroupView, { groupId: group.id, organizationPatch }).setDisplayStyle("popup"))
    }

    editGroup(group: Group) {
        const organizationPatch = OrganizationPatch.create({
            id: this.organization.id,
        })
        this.present(new ComponentWithProperties(EditGroupView, { groupId: group.id, organizationPatch }).setDisplayStyle("popup"))
    }

    groupDescription(group: Group) {
        if (group.settings.minBirthYear && group.settings.maxBirthYear) {
            const startYear = new Date().getFullYear() - group.settings.maxBirthYear
            const endYear = new Date().getFullYear() - group.settings.minBirthYear
            if (startYear == endYear) {
                return startYear+" jaar"
            }
            return startYear + " - "+endYear+" jaar"
        }
        return ""
    }

    deleteGroup(group: Group) {
        if (confirm("Ben je zeker dat je deze groep wilt verwijderen? All leden worden automatisch ook uitgeschreven. Je kan dit niet ongedaan maken!")) {
            if (confirm("Heel zeker?")) {
                const patch = OrganizationManager.getPatch()
                patch.groups.addDelete(group.id)
                OrganizationManager.patch(patch)
                .then(() => {
                    this.present(new ComponentWithProperties(CenteredMessage, { title: "De groep is verwijderd", closeButton: "Sluiten", type: "success" }).setDisplayStyle("overlay"))
                })
                .catch(e => {
                    console.error(e)
                    this.present(new ComponentWithProperties(CenteredMessage, { title: "Er ging iets mis", description: e.human ?? e.message, closeButton: "Sluiten", type: "error" }).setDisplayStyle("overlay"))
                })
            }
        }
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
