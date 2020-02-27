<template>
    <div class="group-list">
        <STNavigationBar :sticky="false">
            <template v-slot:left>
                <STNavigationTitle>
                    <span class="icon-spacer">Kapoenen</span>
                    <button class="button more"></button>
                </STNavigationTitle>
            </template>
            <template v-slot:right>
                <input class="input search" placeholder="Zoeken" />

                <select class="input">
                    <option>Alle leden</option>
                    <option>Niet betaald</option>
                </select>
            </template>
        </STNavigationBar>

        <table class="data-table">
            <thead>
                <tr>
                    <th>
                        <Checkbox :value="selectionCount == members.length" @input="selectAll($event)" />
                    </th>
                    <th>Naam</th>
                    <th>Info</th>
                    <th>Status</th>
                    <th>Acties</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(member, index) in members" :key="index" @click="showMember(member)">
                    <td @click.stop="">
                        <Checkbox v-model="member.selected" @input="onChanged(member)" />
                    </td>
                    <td>{{ member.member.name }}</td>
                    <td class="minor">16 jaar</td>
                    <td>Nog niet betaald</td>
                    <td><button class="button more" @click.stop="showMemberContextMenu"></button></td>
                </tr>
            </tbody>
        </table>

        <div class="toolbar">
            <div>{{ selectionCount ? selectionCount : "Geen" }} leden geselecteerd</div>
            <div>
                <button class="button secundary">Exporteren</button
                ><button class="button primary">Mail iedereen</button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import Checkbox from "shared/components/inputs/Checkbox.vue";
import { Member } from "shared/models/Member";
import GroupListShort from "./GroupListShort.vue";
import NavigationController from "shared/components/layout/NavigationController.vue";
import STNavigationBar from "shared/components/navigation/STNavigationBar.vue";
import MemberView from "./member/MemberView.vue";
import STNavigationTitle from "shared/components/navigation/STNavigationTitle.vue";
import MemberContextMenu from "./member/MemberContextMenu.vue";
import { MemberFactory } from "shared/factories/MemberFactory";

class SelectableMember {
    member: Member;
    selected: boolean = false;

    constructor(member: Member) {
        this.member = member;
    }
}

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STNavigationTitle
    }
})
export default class GroupList extends Mixins(NavigationMixin) {
    members: SelectableMember[] = [];
    selectionCount: number = 0;

    mounted() {
        for (let index = 0; index < 50; index++) {
            this.members.push(new SelectableMember(MemberFactory.create()));
        }
    }
    next() {
        this.show(new ComponentWithProperties(GroupList, {}));
    }

    onChanged(selectableMember: SelectableMember) {
        if (!selectableMember.selected) {
            this.selectionCount--;
        } else {
            this.selectionCount++;
        }
    }

    showMember(selectableMember: SelectableMember) {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberView, {})
        });
        component.modalDisplayStyle = "popup";
        this.present(component);
    }

    selectAll(selected: boolean) {
        this.selectionCount = selected ? this.members.length : 0;
        this.members.forEach(member => {
            member.selected = selected;
        });
    }

    showMemberContextMenu(event) {
        var displayedComponent = new ComponentWithProperties(MemberContextMenu, {
            x: event.clientX,
            y: event.clientY + 10
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>

<style lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';

.group-list {
    padding: 40px var(--st-horizontal-padding, 40px);
    background: $color-white;
}

.data-table {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    width: 100%;
    width: calc(100% + 2 * var(--st-horizontal-padding, 40px));
    border-collapse: separate;

    thead {
        text-align: left;
        font-weight: 600;

        th {
            background: $color-white;
            position: sticky;
            top: 0;
            border-bottom: $border-width solid $color-white-shade;
            @extend .style-table-head;
            padding: 10px;

            &:first-child {
                padding-left: 0;
            }
        }
    }

    tbody {
        td {
            padding: 15px 10px;

            &:first-child {
                padding-left: 0;
            }
        }

        tr {
            transition: background-color 0.15s;
            cursor: pointer;
            touch-action: manipulation;

            td {
                border-top: $border-width-thin solid $color-white-shade;
                transition: border-top-color 0.15s;

                &:first-child {
                    border-top: 0;
                }

                @extend .style-normal;

                &.minor {
                    @extend .style-description;
                }
            }

            &:first-child {
                td {
                    border-top: 0;
                }
            }

            @media (hover: hover) {
                &:hover {
                    background-color: $color-primary-lighter;
                }
            }

            &:active {
                background-color: $color-primary-light;
            }
        }
    }

    thead,
    tbody {
        th,
        td {
            vertical-align: middle;

            &:first-child {
                padding: 0;
                padding-left: 40px - 10px - 5px;
                white-space: nowrap;
                width: 1px;

                .checkbox {
                    margin: 0;
                    padding: 10px;
                }
            }
            &:last-child {
                padding-right: 40px;
                text-align: right;
            }
        }
    }
}

.toolbar {
    padding: 10px 40px;
    background: $color-white;
    position: sticky;
    bottom: 0;
    border-top: $border-width solid $color-white-shade;
    display: flex;
    align-items: center;
    justify-content: space-between;

    > div:first-child {
        @extend .style-description;
    }

    > div .button {
        margin-left: 10px;
    }
}
</style>
