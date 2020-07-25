<template>
    <div class="menu">
        <div class="padding-group">
            <figure id="logo" />
            <button id="organization-switcher" @click="switchOrganization">
                {{ organization.name }}
            </button>

            <input class="input search" placeholder="Zoeken" v-if="false">
        </div>

        <div v-if="organization" class="">
            <button class="menu-button button heading" :class="{ selected: currentlySelected == 'group-all'}" @click="openAll()">
                <span class="icon user"/>
                <span>Leden</span>
                <button class="button">
                    Alle
                </button>
            </button>

            <button
                v-for="group in groups"
                :key="group.group.id"
                class="menu-button"
                :class="{ selected: currentlySelected == 'group-'+group.group.id }"
                @click="openGroup(group)"
            >
                {{ group.group.settings.name }}
            </button>
        </div>
        <hr>
        <div class="">
            <button class="menu-button button heading" @click="manageGroups" :class="{ selected: currentlySelected == 'manage-groups'}">
                <span class="icon group"/>
                <span>Groepen beheren</span>
            </button>
            <button class="menu-button button heading">
                <span class="icon card"/>
                <span>Overschrijvingen</span>
            </button>
            <button class="menu-button button heading">
                <span class="icon settings"/>
                <span>Instellingen</span>
            </button>
        </div>
        <hr>
        <div class="">
            <button class="menu-button button heading">
                <span class="icon logout"/>
                <span>Uitloggen</span>
            </button>
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { OrganizationFactory } from "@stamhoofd-frontend/models";
import { SessionManager } from '@stamhoofd/networking';
import { Organization, Group } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditGroupsView from './groups/EditGroupsView.vue';
import GroupMembersView from "./groups/GroupMembersView.vue";

class SelectableGroup {
    group: Group;
    selected = false;

    constructor(group: Group) {
        this.group = group;
    }
}

@Component({})
export default class Menu extends Mixins(NavigationMixin) {
    organization: Organization = SessionManager.currentSession!.organization!
    groups: SelectableGroup[] = [];
    currentlySelected: string | null = null

    mounted() {
               // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.groups = this.organization.groups!.map((group) => {
            return new SelectableGroup(group);
        });
        if (!this.splitViewController?.shouldCollapse()) {
            this.openGroup(this.groups[0])
        }
    }

    switchOrganization() {
        SessionManager.deactivateSession()
    }

    openAll() {
        this.currentlySelected = "group-all"
        //this.showDetail(new ComponentWithProperties(GroupMembersView, { organization: this.mockOrganization }));
    }

    openGroup(group: SelectableGroup) {
        this.currentlySelected = "group-"+group.group.id
        this.showDetail(new ComponentWithProperties(GroupMembersView, { group: group.group }));
    }

    manageGroups() {
        this.currentlySelected = "manage-groups"
        this.showDetail(new ComponentWithProperties(EditGroupsView, {}));
    }
}
</script>

<style scoped lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#organization-switcher {
    margin-bottom: 15px;
    padding-left: 40px;
    display: flex;
    align-items: center;
    touch-action: manipulation;
    user-select: none;
    cursor: pointer;
    @extend .style-interactive-small;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    transition: opacity 0.2s;

    &:active {  
        opacity: 0.4;
        transition: none;
    }

    &::after {
        content: "";
        display: block;
        width: 10px;
        height: 10px;
        margin-left: 5px;;
        background: url("~@stamhoofd/assets/images/icons/gray/arrow-down-small.svg") center center no-repeat;
    }
}

.menu {
    padding: 30px 0;

    --horizontal-padding: 30px;
}

.input.search {
    margin-bottom: 20px;
}

#logo {
    display: block;
    margin-bottom: 5px;
}

.menu > .padding-group {
    padding-left: var(--horizontal-padding, 30px);
    padding-right: var(--horizontal-padding, 30px);
}

.menu > hr {
    height: $border-width;
    border-radius: $border-width/2;
    background: $color-gray-light;
    border: 0;
    outline: 0;
    margin: 20px var(--horizontal-padding, 30px);
}

.menu-button {
    display: flex;
    flex-direction: row;
    @extend .style-button-smaller;
    color: $color-dark;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    box-sizing: border-box;
    height: 45px;
    cursor: pointer;
    transition: transform 0.2s, background-color 0.2s, color 0.2s;

    text-overflow: ellipsis;
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;

    .icon {
        padding-right: 10px;
    }

    &:active {
        background-color: $color-gray-lighter;
    }

    padding-left: var(--horizontal-padding, 30px);
    padding-right: var(--horizontal-padding, 30px);

    &.heading {
        @extend .style-button-small;
        color: $color-gray-dark;
    }

    &.selected {
        background-color: $color-primary-light;
        color: $color-primary;
        font-weight: 600;
    }

    > button {
        margin-left: auto;
        color: $color-primary;
    }
}
</style>
