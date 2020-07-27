<template>
    <div class="st-view group-members-view">
        <STNavigationBar :sticky="false">
            <template #left>
                <button v-if="canPop" class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
                <STNavigationTitle v-else>
                    <span class="icon-spacer">{{ group ? group.settings.name : "Alle leden" }}</span>
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

    
        <main>
            <h1 v-if="canPop">
                <span class="icon-spacer">{{ group ? group.settings.name : "Alle leden" }}</span>
                <button class="button more" />
            </h1>

            <Spinner class="center" v-if="loading"/>
            <table class="data-table" v-else>
                <thead>
                    <tr>
                        <th>
                            <Checkbox
                                :value="selectionCount >= filteredMembers.length && filteredMembers.length"
                                @change="selectAll($event)"
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
                            <Checkbox v-model="member.selected" @change="onChanged(member)" />
                        </td>
                        <td>
                            <div
                                v-if="isNew(member.member)"
                                v-tooltip="'Ingeschreven op ' + registrationDate(member.member)"
                                class="new-member-bubble"
                            />
                            {{ member.member.details.name }}
                        </td>
                        <td class="minor">
                            {{ member.member.details.age }} jaar
                        </td>
                        <td>{{ member.member.info }}</td>
                        <td>
                            <button class="button icon gray more" @click.stop="showMemberContextMenu($event, member.member)" />
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
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { TooltipDirective as Tooltip } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { STNavigationTitle, Spinner } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { STToolbar } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import { CanNotSwimFilter,FoodAllergyFilter, NoFilter, NotPaidFilter } from "../../../classes/member-filters";
import MailView from "../mail/MailView.vue";
import MemberContextMenu from "../member/MemberContextMenu.vue";
import MemberView from "../member/MemberView.vue";
import GroupListSelectionContextMenu from "./GroupListSelectionContextMenu.vue";
import { MemberWithRegistrations, Group, Organization } from '@stamhoofd/structures';
import { MemberManager } from '../../../classes/MemberManager';

class SelectableMember {
    member: MemberWithRegistrations;
    selected = false;

    constructor(member: MemberWithRegistrations) {
        this.member = member;
    }
}

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STNavigationTitle,
        STToolbar,
        Spinner
    },
    directives: { Tooltip },
})
export default class GroupMembersView extends Mixins(NavigationMixin) {
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

    loading = false;

    mounted() {
        this.loading = true;

        MemberManager.loadMembers(this.group?.id ?? null).then((members) => {
            this.members = members.map((member) => {
                return new SelectableMember(member);
            }) ?? [];
        }).catch((e) => {
            console.error(e)
        }).finally(() => {
            this.loading = false
        })

        // todo!

        /*if (this.group) {
            this.members = this.group.members?.map((member) => {
                return new SelectableMember(member);
            }) ?? [];
        } else {
            this.members = this.organization?.groups?.flatMap((group) => {
                return group.members?.map((member) => {
                    return new SelectableMember(member);
                }) ?? [];
            }) ?? [];
        }*/
    }

    registrationDate(member: MemberWithRegistrations) {
        if (member.registrations.length == 0) {
            return new Date()
        }
        const reg = !this.group ? member.registrations[0] : member.registrations.find(r => r.groupId === this.group!.id)
        if (!reg) {
            return new Date()
        }

        if (!reg.registeredAt) {
            return new Date()
        }
        
        return reg.registeredAt
    }

    isNew(member: MemberWithRegistrations) {
        if (!this.group) {
            return false
        }
        const reg = member.registrations.find(r => r.groupId === this.group!.id)
        if (!reg) {
            return false
        }

        if (!reg.registeredAt) {
            return true
        }
        
        return reg.registeredAt > new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 14)
    }

    get sortedMembers(): SelectableMember[] {
        if (this.sortBy == "info") {
            return this.filteredMembers.sort((a, b) => {
                if (!a.member.details && !b.member.details) {
                    return 0
                }
                if (!a.member.details) {
                    return 1
                }
                if (!b.member.details) {
                    return -1
                }
                if (this.sortDirection == "ASC") {
                    return a.member.details.age - b.member.details.age;
                }
                return b.member.details.age - a.member.details.age;
            });
        }

        if (this.sortBy == "name") {
            return this.filteredMembers.sort((a, b) => {
                if (!a.member.details && !b.member.details) {
                    return 0
                }
                if (!a.member.details) {
                    return 1
                }
                if (!b.member.details) {
                    return -1
                }

                if (this.sortDirection == "ASC") {
                    if (a.member.details.name.toLowerCase() > b.member.details.name.toLowerCase()) {
                        return 1;
                    }
                    if (a.member.details.name.toLowerCase() < b.member.details.name.toLowerCase()) {
                        return -1;
                    }
                    return 0;
                }
                if (a.member.details.name.toLowerCase() > b.member.details.name.toLowerCase()) {
                    return -1;
                }
                if (a.member.details.name.toLowerCase() < b.member.details.name.toLowerCase()) {
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
            if (member.member.details && member.member.details.matchQuery(this.searchQuery)) {
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

    next() {
        this.show(new ComponentWithProperties(GroupMembersView, {}));
    }

    onChanged(_selectableMember: SelectableMember) {
        // do nothing for now
    }

    getPreviousMember(member: MemberWithRegistrations): MemberWithRegistrations | null {
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

    getNextMember(member: MemberWithRegistrations): MemberWithRegistrations | null {
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
        console.log("select all")
        this.filteredMembers.forEach((member) => {
            member.selected = selected;
        });
    }

    showMemberContextMenu(event, member: MemberWithRegistrations) {
        const displayedComponent = new ComponentWithProperties(MemberContextMenu, {
            x: event.clientX,
            y: event.clientY + 10,
            member: member,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    getSelectedMembers(): MemberWithRegistrations[] {
        return this.filteredMembers
            .filter((member: SelectableMember) => {
                return member.selected;
            })
            .map((member: SelectableMember) => {
                return member.member;
            });
    }

    openMail(_event) {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                members: this.getSelectedMembers(),
            })
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
@use '@stamhoofd/scss/base/text-styles.scss';

.group-members-view {
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
