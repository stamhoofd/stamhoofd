<template>
    <div class="st-view group-list">
        <STNavigationBar :sticky="false">
            <template #left>
                <button v-if="canPop" class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
                <STNavigationTitle v-else>
                    <span class="icon-spacer">{{ group ? group.name : "Alle leden" }}</span>
                    <button class="button more" />
                </STNavigationTitle>
            </template>
            <template #right>
                <input v-model="searchQuery" class="input search" placeholder="Zoeken">

                <select v-model="selectedFilter" class="input">
                    <option v-for="(filter, index) in filters" :key="index" :value="index">
                        {{ filter.getName() }}
                    </option>
                </select>
            </template>
        </STNavigationBar>

        <STNavigationTitle v-if="canPop">
            <span class="icon-spacer">{{ group ? group.name : "Alle leden" }}</span>
            <button class="button more" />
        </STNavigationTitle>

        <main>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>
                            <Checkbox
                                :value="selectionCount >= filteredMembers.length && filteredMembers.length"
                                @input="selectAll($event)"
                            />
                        </th>
                        <th @click="toggleSort('name')">
                            Naam
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'name' && sortDirection == 'ASC',
                                    down: sortBy == 'name' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th @click="toggleSort('info')">
                            Leeftijd
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'info' && sortDirection == 'ASC',
                                    down: sortBy == 'info' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th @click="toggleSort('status')">
                            Status
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'status' && sortDirection == 'ASC',
                                    down: sortBy == 'status' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="member in sortedMembers" :key="member.id" @click="showMember(member)">
                        <td @click.stop="">
                            <Checkbox v-model="member.selected" @input="onChanged(member)" />
                        </td>
                        <td>
                            <div
                                v-if="member.member.isNew"
                                v-tooltip="'Ingeschreven op ' + member.member.createdOn"
                                class="new-member-bubble"
                            />
                            {{ member.member.name }}
                        </td>
                        <td class="minor">
                            {{ member.member.age }} jaar
                        </td>
                        <td>{{ member.member.info }}</td>
                        <td>
                            <button class="button more" @click.stop="showMemberContextMenu($event, member.member)" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </main>

        <STToolbar>
            <template #left>
                {{ selectionCount ? selectionCount : "Geen" }} leden geselecteerd
                <template v-if="selectionCountHidden">
                    ({{ selectionCountHidden }} verborgen)
                </template>
            </template>
            <template #right>
                <button class="button secundary">
                    Samenvatting
                </button><button class="button primary" @click="openMail">
                    Mailen
                    <div class="dropdown" @click.stop="openMailDropdown" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import { CanNotSwimFilter,FoodAllergyFilter, NoFilter, NotPaidFilter } from "@stamhoofd/shared/classes/member-filters";
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import Checkbox from "@stamhoofd/shared/components/inputs/Checkbox.vue";
import NavigationController from "@stamhoofd/shared/components/layout/NavigationController.vue";
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue";
import STNavigationTitle from "@stamhoofd/shared/components/navigation/STNavigationTitle.vue";
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue";
import Tooltip from "@stamhoofd/shared/directives/Tooltip";
import { Group } from "@stamhoofd/shared/models/Group";
import { Member } from "@stamhoofd/shared/models/Member";
import { Organization } from "@stamhoofd/shared/models/Organization";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MailView from "../mail/MailView.vue";
import MemberContextMenu from "../member/MemberContextMenu.vue";
import MemberView from "../member/MemberView.vue";
import GroupListSelectionContextMenu from "./GroupListSelectionContextMenu.vue";

class SelectableMember {
    member: Member;
    selected = false;

    constructor(member: Member) {
        this.member = member;
    }
}

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STNavigationTitle,
        STToolbar,
    },
    directives: { Tooltip },
})
export default class GroupList extends Mixins(NavigationMixin) {
    @Prop()
    group!: Group | null;

    @Prop()
    organization!: Organization | null;

    members: SelectableMember[] = [];
    searchQuery = "";
    filters = [new NoFilter(), new NotPaidFilter(), new FoodAllergyFilter(), new CanNotSwimFilter()];
    selectedFilter = 0;
    selectionCountHidden = 0;
    sortBy = "info";
    sortDirection = "ASC";

    get sortedMembers(): SelectableMember[] {
        if (this.sortBy == "info") {
            return this.filteredMembers.sort((a, b) => {
                if (this.sortDirection == "ASC") {
                    return a.member.age - b.member.age;
                }
                return b.member.age - a.member.age;
            });
        }

        if (this.sortBy == "name") {
            return this.filteredMembers.sort((a, b) => {
                if (this.sortDirection == "ASC") {
                    if (a.member.name.toLowerCase() > b.member.name.toLowerCase()) {
                        return 1;
                    }
                    if (a.member.name.toLowerCase() < b.member.name.toLowerCase()) {
                        return -1;
                    }
                    return 0;
                }
                if (a.member.name.toLowerCase() > b.member.name.toLowerCase()) {
                    return -1;
                }
                if (a.member.name.toLowerCase() < b.member.name.toLowerCase()) {
                    return 1;
                }
                return 0;
            });
        }

        if (this.sortBy == "status") {
            return this.filteredMembers.sort((a, b) => {
                if (this.sortDirection == "ASC") {
                    if (a.member.info.toLowerCase() > b.member.info.toLowerCase()) {
                        return 1;
                    }
                    if (a.member.info.toLowerCase() < b.member.info.toLowerCase()) {
                        return -1;
                    }
                    return 0;
                }
                if (a.member.info.toLowerCase() > b.member.info.toLowerCase()) {
                    return -1;
                }
                if (a.member.info.toLowerCase() < b.member.info.toLowerCase()) {
                    return 1;
                }
                return 0;
            });
        }
        return this.filteredMembers;
    }

    get filteredMembers(): SelectableMember[] {
        this.selectionCountHidden = 0;
        const filtered = this.members.filter((member: SelectableMember) => {
            if (this.filters[this.selectedFilter].doesMatch(member.member)) {
                return true;
            }
            this.selectionCountHidden += member.selected ? 1 : 0;
            return false;
        });

        if (this.searchQuery == "") {
            return filtered;
        }
        return filtered.filter((member: SelectableMember) => {
            if (member.member.matchQuery(this.searchQuery)) {
                return true;
            }
            this.selectionCountHidden += member.selected ? 1 : 0;
            return false;
        });
    }

    get selectionCount(): number {
        let val = 0;
        this.filteredMembers.forEach((member) => {
            if (member.selected) {
                val++;
            }
        });
        return val;
    }

    toggleSort(field: string) {
        if (this.sortBy == field) {
            if (this.sortDirection == "ASC") {
                this.sortDirection = "DESC";
            } else {
                this.sortDirection = "ASC";
            }
            return;
        }
        this.sortBy = field;
    }

    mounted() {
        if (this.group) {
            this.members = this.group.members?.map((member) => {
                return new SelectableMember(member);
            }) ?? [];
        } else {
            this.members = this.organization?.groups?.flatMap((group) => {
                return group.members?.map((member) => {
                    return new SelectableMember(member);
                }) ?? [];
            }) ?? [];
        }
    }
    next() {
        this.show(new ComponentWithProperties(GroupList, {}));
    }

    onChanged(_selectableMember: SelectableMember) {
        // do nothing for now
    }

    getPreviousMember(member: Member): Member | null {
        for (let index = 0; index < this.sortedMembers.length; index++) {
            const _member = this.sortedMembers[index];
            if (_member.member.id == member.id) {
                if (index == 0) {
                    return null;
                }
                return this.sortedMembers[index - 1].member;
            }
        }
        return null;
    }

    getNextMember(member: Member): Member | null {
        for (let index = 0; index < this.sortedMembers.length; index++) {
            const _member = this.sortedMembers[index];
            if (_member.member.id == member.id) {
                if (index == this.sortedMembers.length - 1) {
                    return null;
                }
                return this.sortedMembers[index + 1].member;
            }
        }
        return null;
    }

    showMember(selectableMember: SelectableMember) {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberView, {
                member: selectableMember.member,
                // eslint-disable-next-line @typescript-eslint/unbound-method
                getNextMember: this.getNextMember,
                // eslint-disable-next-line @typescript-eslint/unbound-method
                getPreviousMember: this.getPreviousMember,
            }),
        });
        component.modalDisplayStyle = "popup";
        this.present(component);
    }

    selectAll(selected: boolean) {
        this.filteredMembers.forEach((member) => {
            member.selected = selected;
        });
    }

    showMemberContextMenu(event, member: Member) {
        const displayedComponent = new ComponentWithProperties(MemberContextMenu, {
            x: event.clientX,
            y: event.clientY + 10,
            member: member,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    getSelectedMembers(): Member[] {
        return this.filteredMembers
            .filter((member: SelectableMember) => {
                return member.selected;
            })
            .map((member: SelectableMember) => {
                return member.member;
            });
    }

    openMail(_event) {
        const displayedComponent = new ComponentWithProperties(MailView, {
            members: this.getSelectedMembers(),
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openMailDropdown(event) {
        const displayedComponent = new ComponentWithProperties(GroupListSelectionContextMenu, {
            x: event.clientX,
            y: event.clientY + 10,
            members: this.getSelectedMembers(),
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/layout/split-inputs.scss';
@use '@stamhoofd/scss/base/text-styles.scss';
@use '@stamhoofd/scss/components/inputs.scss';
@use '@stamhoofd/scss/components/buttons.scss';
@use '@stamhoofd/scss/layout/view.scss';

.group-list {
    background: $color-white;

    .new-member-bubble {
        display: inline-block;
        vertical-align: middle;
        width: 5px;
        height: 5px;
        border-radius: 2.5px;
        background: $color-primary;
        margin-left: -10px;
        margin-right: 5px;
    }
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
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;

            &:first-child {
                padding-left: 0;
            }

            .sort-arrow {
                vertical-align: middle;
                width: 24px;
                height: 24px;
                display: inline-block;
                background: transparent;

                &.up {
                    background: url(~@stamhoofd/assets/images/icons/gray/arrow-up-small.svg) no-repeat center center;
                }
                &.down {
                    background: url(~@stamhoofd/assets/images/icons/gray/arrow-down-small.svg) no-repeat center center;
                }
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
