<template>
    <div class="menu">
        <div class="padding-group">
            <figure id="logo" />
            <button id="organization-switcher" @click="switchOrganization">
                {{ organization.name }}
            </button>

            <input class="input search" placeholder="Zoeken">
        </div>

        <div v-if="organization" class="">
            <button class="menu-button icon user">
                <span>Leden</span>
                <button @click="openAll()">
                    Iedereen
                </button>
            </button>

            <button
                v-for="group in groups"
                :key="group.group.id"
                class="menu-button"
                :class="{ selected: group.selected }"
                @click="openGroup(group)"
            >
                {{ group.group.name }}
            </button>
        </div>
        <hr>
        <div class="">
            <button class="menu-button icon groups" @click="manageGroups">
                Groepen beheren
            </button>
            <button class="menu-button icon payments">
                Overschrijvingen
            </button>
            <button class="menu-button icon settings">
                Instellingen
            </button>
        </div>
        <hr>
        <div class="">
            <button class="menu-button icon logout">
                Uitloggen
            </button>
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { Group } from "@stamhoofd-frontend/models";
import { Organization as MockOrganization } from "@stamhoofd-frontend/models";
import { OrganizationFactory } from "@stamhoofd-frontend/models";
import { SessionManager } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import GroupListView from './groups/GroupListView.vue';
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
    mockOrganization: MockOrganization | null = null;
    groups: SelectableGroup[] = [];
    selectedGroup: SelectableGroup | null = null;

    mounted() {
        const factory = new OrganizationFactory({
            type: "chiro",
        });
        this.mockOrganization = factory.create();

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.groups = this.mockOrganization.groups!.map((group) => {
            return new SelectableGroup(group);
        });
        if (!this.splitViewController?.shouldCollapse()) {
            this.selectedGroup = this.groups[0];
            this.selectedGroup.selected = true;
            this.showDetail(
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(GroupMembersView, {
                        group: this.selectedGroup.group,
                    }),
                })
            );
        }
    }

    switchOrganization() {
        SessionManager.deactivateSession()
    }

    openAll() {
        if (this.selectedGroup) {
            this.selectedGroup.selected = false;
        }
        this.showDetail(new ComponentWithProperties(GroupMembersView, { organization: this.mockOrganization }));
    }

    openGroup(group: SelectableGroup) {
        if (this.selectedGroup) {
            this.selectedGroup.selected = false;
        }
        this.selectedGroup = group;
        this.selectedGroup.selected = true;
        this.showDetail(new ComponentWithProperties(GroupMembersView, { group: group.group }));
    }

    manageGroups() {
        this.showDetail(new ComponentWithProperties(GroupListView, {}));
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
    color: $color-dark;
    font-weight: 500;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    box-sizing: border-box;
    height: 45px;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;

    padding-left: var(--horizontal-padding, 30px);
    padding-right: var(--horizontal-padding, 30px);

    &:hover {
        background-color: $color-primary-lighter;
    }

    &.selected {
        background-color: $color-primary-light;
        color: $color-primary;
        font-weight: 600;
    }

    &.icon {
        color: $color-gray;
        font-weight: 600;
        padding-left: calc(var(--horizontal-padding, 30px) + 32px);

        button {
            color: $color-gray-light;
            cursor: pointer;
        }
        background-position: var(--horizontal-padding, 30px) center;

        &.user {
            background-image: url(~@stamhoofd/assets/images/icons/gray/user.svg);
        }

        &.groups {
            background-image: url(~@stamhoofd/assets/images/icons/gray/group.svg);
        }

        &.payments {
            background-image: url(~@stamhoofd/assets/images/icons/gray/payments.svg);
        }

        &.settings {
            background-image: url(~@stamhoofd/assets/images/icons/gray/settings.svg);
        }

        &.logout {
            background-image: url(~@stamhoofd/assets/images/icons/gray/logout.svg);
        }
        background-repeat: no-repeat;
    }
}
</style>
