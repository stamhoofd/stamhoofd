<template>
    <div class="menu">
        <div class="padding-group">
            <figure id="logo"></figure>

            <input class="input search" placeholder="Zoeken" />
        </div>

        <div class="">
            <button class="menu-button icon user">
                <span>Leden</span>
                <button>Iedereen</button>
            </button>

            <button class="menu-button" @click="kapoenen">Kapoenen</button>
            <button class="menu-button" @click="wouters">Wouters</button>
            <button class="menu-button" @click="woutersShow">Welpen</button>
            <button class="menu-button" @click="jonggidsen">Jonggidsen</button>
            <button class="menu-button" @click="jongverkenners">Jongverkenners</button>
            <button class="menu-button">Gidsen</button>
            <button class="menu-button">Verkenners</button>
            <button class="menu-button">Jin</button>
            <button class="menu-button">Akabe</button>
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

@Component({})
export default class Menu extends Mixins(NavigationMixin) {
    mounted() {
        if (!this.splitViewController.shouldCollapse())
            this.showDetail(
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(GroupList, {})
                })
            );
    }

    kapoenen() {
        this.showDetail(new ComponentWithProperties(GroupList, {}));
    }

    wouters() {
        this.showDetail(new ComponentWithProperties(GroupListShort, {}));
    }

    woutersShow() {
        this.show(new ComponentWithProperties(GroupList, {}));
    }

    jonggidsen() {
        const comp = new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(Menu, {})
        });
        comp.modalDisplayStyle = "popup";
        this.present(comp);
    }

    jongverkenners() {
        const comp = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(GroupList, {})
        });
        this.present(comp);
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

    padding-left: var(--horizontal-padding, 30px);
    padding-right: var(--horizontal-padding, 30px);

    &:hover {
        background-color: $color-primary-lighter;
    }

    &.selected {
        background-color: $color-primary-lighter;
        color: $color-primary;
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
