<template>
    <div class="st-view group-list">
        <STNavigationBar :sticky="false">
            <template v-slot:left>
                <STNavigationTitle>
                    <span class="icon-spacer">Leden</span>
                    <button class="button more"></button>
                </STNavigationTitle>
            </template>
            <template v-slot:right>
                <input class="input search" placeholder="Zoeken" v-model="searchQuery" />

                <select class="input" v-model="selectedFilter">
                    <option :value="index" :key="index" v-for="(filter, index) in filters">{{
                        filter.getName()
                    }}</option>
                </select>
            </template>
        </STNavigationBar>

        <main>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>
                            <Checkbox :value="selectionCount >= filteredMembers.length" @input="selectAll($event)" />
                        </th>
                        <th>Naam</th>
                        <th>Info</th>
                        <th>Status</th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(member, index) in filteredMembers" :key="index" @click="showMember(member)">
                        <td @click.stop="">
                            <Checkbox v-model="member.selected" @input="onChanged(member)" />
                        </td>
                        <td>{{ member.member.name }}</td>
                        <td class="minor">{{ member.member.age }} jaar</td>
                        <td>{{ member.member.info }}</td>
                        <td><button class="button more" @click.stop="showMemberContextMenu"></button></td>
                    </tr>
                </tbody>
            </table>
        </main>

        <STToolbar>
            <template v-slot:left>
                {{ selectionCount ? selectionCount : "Geen" }} leden geselecteerd
                <template v-if="selectionCountHidden"> ({{ selectionCountHidden }} verborgen) </template>
            </template>
            <template v-slot:right>
                <button class="button secundary">Samenvatting</button
                ><button class="button primary" @click="openMail">
                    Mailen
                    <div class="dropdown" @click.stop="openMailDropdown"></div>
                </button>
            </template>
        </STToolbar>
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
import GroupListSelectionContextMenu from "./GroupListSelectionContextMenu.vue";
import MailView from "./mail/MailView.vue";
import STToolbar from "shared/components/navigation/STToolbar.vue";
import { NoFilter, NotPaidFilter } from "shared/classes/member-filters";

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
        STNavigationTitle,
        STToolbar
    }
})
export default class GroupList extends Mixins(NavigationMixin) {
    members: SelectableMember[] = [];
    searchQuery: string = "";
    filters = [new NoFilter(), new NotPaidFilter()];
    selectedFilter = 0;
    selectionCountHidden = 0;

    get filteredMembers(): SelectableMember[] {
        this.selectionCountHidden = 0;
        var filtered = this.members.filter((member: SelectableMember) => {
            if (this.filters[this.selectedFilter].doesMatch(member.member)) {
                return true;
            }
            this.selectionCountHidden += 1;
            return false;
        });

        if (this.searchQuery == "") {
            return filtered;
        }
        return filtered.filter((member: SelectableMember) => {
            if (member.member.matchQuery(this.searchQuery)) {
                return true;
            }
            this.selectionCountHidden += 1;
            return false;
        });
    }

    get selectionCount(): number {
        var val = 0;
        this.filteredMembers.forEach(member => {
            if (member.selected) {
                val++;
            }
        });
        return val;
    }

    mounted() {
        for (let index = 0; index < 50; index++) {
            this.members.push(new SelectableMember(MemberFactory.create()));
        }
    }
    next() {
        this.show(new ComponentWithProperties(GroupList, {}));
    }

    onChanged(selectableMember: SelectableMember) {}

    getPreviousMember(member: Member): Member | null {
        for (let index = 0; index < this.filteredMembers.length; index++) {
            const _member = this.filteredMembers[index];
            if (_member.member.id == member.id) {
                if (index == 0) {
                    return null;
                }
                return this.filteredMembers[index - 1].member;
            }
        }
        return null;
    }

    getNextMember(member: Member): Member | null {
        for (let index = 0; index < this.filteredMembers.length; index++) {
            const _member = this.filteredMembers[index];
            if (_member.member.id == member.id) {
                if (index == this.filteredMembers.length - 1) {
                    return null;
                }
                return this.filteredMembers[index + 1].member;
            }
        }
        return null;
    }

    showMember(selectableMember: SelectableMember) {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberView, {
                member: selectableMember.member,
                getNextMember: this.getNextMember,
                getPreviousMember: this.getPreviousMember
            })
        });
        component.modalDisplayStyle = "popup";
        this.present(component);
    }

    selectAll(selected: boolean) {
        this.filteredMembers.forEach(member => {
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

    getSelectedMembers(): Member[] {
        return this.members
            .filter((member: SelectableMember) => {
                return member.selected;
            })
            .map((member: SelectableMember) => {
                return member.member;
            });
    }

    openMail(event) {
        var displayedComponent = new ComponentWithProperties(MailView, {
            members: this.getSelectedMembers()
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openMailDropdown(event) {
        var displayedComponent = new ComponentWithProperties(GroupListSelectionContextMenu, {
            x: event.clientX,
            y: event.clientY + 10,
            members: this.getSelectedMembers()
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
@use '~scss/layout/view.scss';

.group-list {
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
</style>
