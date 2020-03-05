<template>
    <div class="menu">
        <div class="padding-group">
            <figure id="logo"></figure>

            <input class="input search" placeholder="Zoeken" />
        </div>

        <div class="" v-if="organization">
            <button class="menu-button icon user">
                <span>Leden</span>
                <button @click="openAll()">Iedereen</button>
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
        <hr />
        <div class="">
            <button class="menu-button icon groups">Groepen beheren</button>
            <button class="menu-button icon payments">Overschrijvingen</button>
            <button class="menu-button icon settings">Instellingen</button>
        </div>
        <hr />
        <div class="">
            <button class="menu-button icon logout">Uitloggen</button>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import EditGroupDetail from "./EditGroupDetail.vue";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import GroupList from "./GroupList.vue";
import GroupListShort from "./GroupListShort.vue";
import NavigationController from "../../shared/components/layout/NavigationController.vue";
import SplitViewController from "../../shared/components/layout/SplitViewController.vue";
import { Organization } from "shared/models/Organization";
import { OrganizationFactory } from "shared/factories/OrganizationFactory";
import { Group } from "shared/models/Group";

class SelectableGroup {
    group: Group;
    selected: boolean = false;

    constructor(group: Group) {
        this.group = group;
    }
}

@Component({})
export default class Menu extends Mixins(NavigationMixin) {
    organization: Organization | null = null;
    groups: SelectableGroup[] = [];
    selectedGroup: SelectableGroup | null = null;

    mounted() {
        var factory = new OrganizationFactory({
            type: "chiro"
        });
        this.organization = factory.create();

        this.groups = this.organization.groups.map(group => {
            return new SelectableGroup(group);
        });
        if (!this.splitViewController.shouldCollapse()) {
            this.selectedGroup = this.groups[0];
            this.selectedGroup.selected = true;
            this.showDetail(
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(GroupList, {
                        group: this.selectedGroup.group
                    })
                })
            );
        }
    }

    openAll() {
        if (this.selectedGroup) {
            this.selectedGroup.selected = false;
        }
        this.showDetail(new ComponentWithProperties(GroupList, { organization: this.organization }));
    }

    openGroup(group: SelectableGroup) {
        if (this.selectedGroup) {
            this.selectedGroup.selected = false;
        }
        this.selectedGroup = group;
        this.selectedGroup.selected = true;
        this.showDetail(new ComponentWithProperties(GroupList, { group: group.group }));
    }
}
</script>

<style scoped lang="scss">
@use "scss/components/logo.scss";
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';

.menu {
    padding: 30px 0;

    --horizontal-padding: 30px;
}

.input.search {
    margin-bottom: 20px;
}

#logo {
    display: block;
    margin-bottom: 15px;
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
        }
        background-position: var(--horizontal-padding, 30px) center;

        &.user {
            background-image: url(~assets/images/icons/gray/user.svg);
        }

        &.groups {
            background-image: url(~assets/images/icons/gray/group.svg);
        }

        &.payments {
            background-image: url(~assets/images/icons/gray/payments.svg);
        }

        &.settings {
            background-image: url(~assets/images/icons/gray/settings.svg);
        }

        &.logout {
            background-image: url(~assets/images/icons/gray/logout.svg);
        }
        background-repeat: no-repeat;
    }
}
</style>
