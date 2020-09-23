<template>
    <div class="st-view group-members-view background">
        <STNavigationBar :sticky="false">
            <template #left>
                <BackButton slot="left" v-if="canPop" @click="pop"/>
                <STNavigationTitle v-else>
                    <span class="icon-spacer">{{ title }}</span>
                    <span class="style-tag" v-if="hasWaitingList" @click="openWaitingList">Wachtlijst</span>
                    <span class="style-tag" :class="{ error: isFull}" v-if="!loading && maxMembers">{{ members.length }} / {{ maxMembers }}</span>

                    <button class="button text" @click="addMember">
                        <span class="icon add" />
                        <span>Nieuw</span>
                    </button>
                </STNavigationTitle>
            </template>
            <template #right>
                <input v-model="searchQuery" class="input search hide-smartphone" placeholder="Zoeken">

                <select v-model="selectedFilter" class="input hide-smartphone" v-if="!waitingList">
                    <option v-for="(filter, index) in filters" :key="index" :value="index">
                        {{ filter.getName() }}
                    </option>
                </select>
            </template>
        </STNavigationBar>

    
        <main>
            <h1 v-if="canPop">
                <span class="icon-spacer">{{ title }}</span>
                <span class="style-tag" v-if="hasWaitingList" @click="openWaitingList">Wachtlijst</span>
            </h1>

            <Spinner class="center" v-if="loading"/>
            <table class="data-table" v-else>
                <thead>
                    <tr>
                        <th>
                            <Checkbox
                                v-model="selectAll"
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
                        <th @click="toggleSort('info')" class="hide-smartphone">
                            Leeftijd
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'info' && sortDirection == 'ASC',
                                    down: sortBy == 'info' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th @click="toggleSort('status')" class="hide-smartphone">
                            {{ waitingList ? "Op wachtlijst sinds" : "Status"}}
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
                    <tr v-for="member in sortedMembers" :key="member.id" @click="showMember(member)" @contextmenu.prevent="showMemberContextMenu($event, member.member)">
                        <td @click.stop="">
                            <Checkbox v-model="member.selected" @change="onChanged(member)" />
                        </td>
                        <td>
                            <h2 class="style-title-list">
                                <div
                                    v-if="!waitingList && isNew(member.member)"
                                    v-tooltip="'Ingeschreven op ' + formatDate(registrationDate(member.member))"
                                    class="new-member-bubble"
                                />
                                {{ member.member.name }}
                                <span class="style-tag warn" v-if="waitingList && canRegister(member.member)" v-tooltip="'Dit lid kan zich inschrijven via de uitnodiging'">Toegelaten</span>
                            </h2>
                            <p class="style-description-small" v-if="!group">{{ member.member.groups.map(g => g.settings.name ).join(", ") }}</p>
                            <p class="style-description-small only-smartphone">{{ member.member.details.age }} jaar</p>
                        </td>
                        <td class="minor hide-smartphone" v-if="member.member.details">
                            {{ member.member.details.age }} jaar
                        </td>
                        <td class="minor hide-smartphone" v-else>
                            /
                        </td>
                        <td class="hide-smartphone">
                            {{ waitingList ? formatDate(registrationDate(member.member)) : member.member.info }}
                        </td>
                        <td>
                            <button class="button icon gray more" @click.stop="showMemberContextMenu($event, member.member)" />
                        </td>
                    </tr>
                </tbody>
            </table>

            <p class="info-box" v-if="!loading && members.length == 0">Er zijn nog geen leden ingeschreven in deze leeftijdsgroep.</p>
        </main>

        <STToolbar>
            <template #left>
                {{ selectionCount ? selectionCount : "Geen" }} {{ selectionCount == 1 ? "lid" : "leden" }} geselecteerd
                <template v-if="selectionCountHidden">
                    (waarvan {{ selectionCountHidden }} verborgen)
                </template>
            </template>
            <template #right>
                <button class="button secundary" @click="openMail()" v-if="waitingList" :disabled="selectionCount == 0">
                    Mailen
                </button>
                <button class="button secundary" @click="allowMembers(false)" v-if="waitingList" :disabled="selectionCount == 0">
                    Toelating intrekken
                </button>
                <LoadingButton :loading="actionLoading" v-if="waitingList">
                    <button class="button primary" @click="allowMembers(true)" :disabled="selectionCount == 0">
                        Toelaten
                    </button>
                </LoadingButton>
                <template v-else>
                    <button class="button secundary" @click="openSamenvatting" :disabled="selectionCount == 0">
                        Samenvatting
                    </button>
                    <LoadingButton :loading="actionLoading">
                        <button class="button primary" @click="openMail()" :disabled="selectionCount == 0">
                            <span class="dropdown-text">Mailen</span>
                            <div class="dropdown" @click.stop="openMailDropdown" />
                        </button>
                    </LoadingButton>
                </template>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { TooltipDirective as Tooltip, CenteredMessage } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { STNavigationTitle, Spinner, BackButton, LoadingButton } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { STToolbar } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import { CanNotSwimFilter,FoodAllergyFilter, NoFilter, NotPaidFilter } from "../../../classes/member-filters";
import MailView from "../mail/MailView.vue";
import MemberContextMenu from "../member/MemberContextMenu.vue";
import MemberView from "../member/MemberView.vue";
import GroupListSelectionContextMenu from "./GroupListSelectionContextMenu.vue";
import { MemberWithRegistrations, Group, Organization, WaitingListType, EncryptedMemberWithRegistrationsPatch, Registration, Member } from '@stamhoofd/structures';
import { MemberManager, MemberChangeEvent } from '../../../classes/MemberManager';
import { Formatter } from '@stamhoofd/utility';
import EditMemberView from '../member/edit/EditMemberView.vue';
import MemberSummaryView from '../member/MemberSummaryView.vue';

class SelectableMember {
    member: MemberWithRegistrations;
    selected = true;

    constructor(member: MemberWithRegistrations, selected: boolean = true) {
        this.member = member;
        this.selected = selected
    }
}

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STNavigationTitle,
        STToolbar,
        BackButton,
        Spinner,
        LoadingButton
    },
    directives: { Tooltip },
})
export default class GroupMembersView extends Mixins(NavigationMixin) {
    @Prop()
    group!: Group | null;

    @Prop({ default: false })
    waitingList!: boolean;

    members: SelectableMember[] = [];
    searchQuery = "";
    filters = [new NoFilter(), new NotPaidFilter(), new FoodAllergyFilter(), new CanNotSwimFilter()];
    selectedFilter = 0;
    selectionCountHidden = 0;
    sortBy = "info";
    sortDirection = "ASC";

    loading = false;

    actionLoading = false
    cachedWaitingList: boolean | null = null

    mounted() {
        this.reload();
    }

    onUpdateMember(type: MemberChangeEvent, member: MemberWithRegistrations | null) {
        if (type == "changedGroup" || type == "deleted" || type == "created" || type == "payment") {
            this.reload()
        }
    }

    activated() {
        MemberManager.addListener(this, this.onUpdateMember)
    }

    deactivated() {
        MemberManager.removeListener(this)
    }

    get isFull() {
        if (!this.group || this.group.settings.maxMembers === null) {
            return false;
        }
        return this.members.length >= this.group.settings.maxMembers
    }

    get maxMembers() {
         if (!this.group || this.group.settings.maxMembers === null) {
            return 0;
        }
        return this.group.settings.maxMembers
    }

    checkWaitingList() {
        MemberManager.loadMembers(this.group?.id ?? null, true).then((members) => {
            this.cachedWaitingList = members.length > 0
        }).catch((e) => {
            console.error(e)
        })
    }

    reload() {
        this.loading = true;
        MemberManager.loadMembers(this.group?.id ?? null, this.waitingList).then((members) => {
            this.members = members.map((member) => {
                return new SelectableMember(member, !this.waitingList);
            }) ?? [];
        }).catch((e) => {
            console.error(e)
        }).finally(() => {
            this.loading = false

            if (!this.waitingList && this.group && this.group.settings.maxMembers !== null) {
                this.checkWaitingList()
            }
        })
    }

    openWaitingList() {
        this.show(new ComponentWithProperties(GroupMembersView, {
            group: this.group,
            waitingList: true
        }))
    }

    get hasWaitingList() {
        if (this.waitingList) {
            return false;
        }
        if (this.cachedWaitingList !== null) {
            return this.cachedWaitingList
        }
        if (!this.group) {
            return false;
        }
        return this.group.settings.waitingListType == WaitingListType.All || this.group.settings.waitingListType == WaitingListType.ExistingMembersFirst
    }

    get title() {
        return this.waitingList ? "Wachtlijst" : (this.group ? this.group.settings.name : "Alle leden")
    }

    formatDate(date: Date) {
        return Formatter.dateTime(date)
    }

    registrationDate(member: MemberWithRegistrations) {
        if (member.registrations.length == 0) {
            return new Date()
        }
        const reg = !this.group ? member.registrations[0] : member.registrations.find(r => r.groupId === this.group!.id)
        if (!reg) {
            return new Date()
        }

        if (!reg.registeredAt || this.waitingList) {
            return reg.createdAt
        }
        
        return reg.registeredAt
    }

    addMember() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditMemberView, {

            })
        }).setDisplayStyle("popup"))
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
            const s = Member.sorterByName(this.sortDirection)
            return this.filteredMembers.sort((a, b) => s(a.member, b.member));
        }

        if (this.sortBy == "status") {
            if (this.waitingList) {
                return this.filteredMembers.sort((a, b) => {
                    if (this.sortDirection == "ASC") {
                        if (this.registrationDate(a.member) > this.registrationDate(b.member)) {
                            return 1;
                        }
                        if (this.registrationDate(a.member) < this.registrationDate(b.member)) {
                            return -1;
                        }
                        return 0;
                    }
                    if (this.registrationDate(a.member) > this.registrationDate(b.member)) {
                        return -1;
                    }
                    if (this.registrationDate(a.member) < this.registrationDate(b.member)) {
                        return 1;
                    }
                    return 0;
                });
            }
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
        this.members.forEach((member) => {
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

    get selectAll() {
        return this.selectionCount - this.selectionCountHidden >= this.filteredMembers.length && this.filteredMembers.length > 0
    }

    set selectAll(selected: boolean) {
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
        return this.members
            .filter((member: SelectableMember) => {
                return member.selected;
            })
            .map((member: SelectableMember) => {
                return member.member;
            });
    }

    canRegister(member: MemberWithRegistrations) {
        if (!this.group) {
            return false
        }
        return member.registrations.find(r => r.groupId == this.group!.id && r.waitingList && r.canRegister && r.cycle == this.group!.cycle)
    }

    async allowMembers(allow = true) {
        if (this.actionLoading) {
            return;
        }

        const members = this.getSelectedMembers().filter(m => !this.group || (allow && m.waitingGroups.find(r => r.id === this.group!.id)) || (!allow && m.acceptedWaitingGroups.find(r => r.id === this.group!.id)))
        if (members.length == 0) {
            return;
        }

        this.actionLoading = true;
        try {
            const patches = MemberManager.getPatchArray()
            for (const member of members) {
                const registrationsPatch = MemberManager.getRegistrationsPatchArray()

                const registration = member.registrations.find(r => r.groupId == this.group!.id && r.waitingList == true && r.cycle == this.group!.cycle)
                if (!registration) {
                    throw new Error("Not found")
                }
                registrationsPatch.addPatch(Registration.patchType().create({
                    id: registration.id,
                    canRegister: allow
                }))

                patches.addPatch(EncryptedMemberWithRegistrationsPatch.create({
                    id: member.id,
                    registrations: registrationsPatch
                }))
            }
            await MemberManager.patchMembers(patches)
        } catch (e) {
            console.error(e)
            // todo
        }
        this.actionLoading = false
        this.reload()

        if (allow) {
            this.openMail("Je kan nu inschrijven!")
        }
    }

    openMail(subject = "") {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                members: this.getSelectedMembers(),
                group: this.group,
                defaultSubject: subject
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openMailDropdown(event) {
        if (this.selectionCount == 0) {
            return;
        }
        const displayedComponent = new ComponentWithProperties(GroupListSelectionContextMenu, {
            x: event.clientX,
            y: event.clientY + 10,
            members: this.getSelectedMembers(),
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    openSamenvatting() {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberSummaryView, {
                members: this.getSelectedMembers(),
                group: this.group
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));

        //this.present(new ComponentWithProperties(CenteredMessage, { title: "Binnenkort beschikbaar!", description: "Deze functie is op dit moment nog niet beschikbaar, maar mag je vrij snel verwachten. Contacteer ons gerust als je hierover vragen hebt.", closeButton: "Sluiten", type: "health" }).setDisplayStyle("overlay"))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.group-members-view {
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
    user-select: none;
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
                padding-left: 40px - 10px;
                padding-left: calc(var(--st-horizontal-padding, 40px) - 10px);
                white-space: nowrap;
                width: 1px;

                .checkbox {
                    margin: 0;
                    padding: 10px;
                }
            }
            &:last-child {
                padding-right: 40px;
                padding-right: calc(var(--st-horizontal-padding, 40px));
                text-align: right;
            }
        }
    }
}
</style>
