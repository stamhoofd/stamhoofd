import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { Group, MemberWithRegistrations, RegisterItem } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import GroupView from "../views/groups/GroupView.vue";
import MemberChooseGroupsView from "../views/members/MemberChooseGroupsView.vue";
import { CheckoutManager } from "./CheckoutManager";

export class Suggestion {
    group?: Group;
    member: MemberWithRegistrations;
    waitingList: boolean;
    id: string;
    invited: boolean;

    constructor(options: {group?: Group, member: MemberWithRegistrations, waitingList: boolean, id: string, invited: boolean}) {
        this.group = options.group
        this.member = options.member
        this.waitingList = options.waitingList
        this.id = options.id
        this.invited = options.invited
    }

    get title() {
        if (this.waitingList) {
            if (this.group) {
                return this.member.firstName + " inschrijven op wachtlijst voor "+this.group.settings.name
            }
            return  this.member.firstName + " inschrijven op wachtlijst"
        }
        if (this.group) {
            return this.member.firstName + " inschrijven voor "+this.group.settings.name
        }
        return this.member.firstName + " inschrijven"
    }

    get description() {
        if (this.invited) {
            return "Je bent uitgenodigd om in te schrijven."
        }
        if (this.group && this.group.settings.registrationEndDate) {
            return "Inschrijvingen sluiten op " + Formatter.dateTime(this.group.settings.registrationEndDate)
        }
        return ""
    }

    merge(other: Suggestion) {
        this.group = undefined
        this.waitingList = this.waitingList && other.waitingList
    }

    getComponent() {
        if (!this.group) {
            return new ComponentWithProperties(MemberChooseGroupsView, {
                member: this.member
            })
        }
        return new ComponentWithProperties(GroupView, {
            group: this.group,
            member: this.member
        })
    }
}


export class SuggestionBuilder {
    static getSuggestions($checkoutManager: CheckoutManager, members: MemberWithRegistrations[]) {
        const $memberManager = $checkoutManager.$memberManager;
        const $context = $memberManager.$context;

        const suggestions: Suggestion[] = []
        const groups = $context.user?.permissions ? $context.organization!.adminAvailableGroups : $context.organization!.availableGroups

        // Rules for suggesting registrations
        // Multiple registrations possible -> suggest one general item
        // Specific registrations are only suggested for members without an active registration OR when the registrations for that groups are 'restricted' to other groups

        for (const member of members) {
            for (const group of groups) {
                const canRegister = member.canRegister(group, $memberManager.members ?? [], $context.organization!.meta.categories, $checkoutManager.cart.items);
                
                // Check in cart
                const item = new RegisterItem(member, group, { reduced: false, waitingList: canRegister.waitingList })
                if ($checkoutManager.cart.hasItem(item)) {
                    continue;
                }
                
                if (!canRegister.closed) {
                    suggestions.push(new Suggestion({ group, member, waitingList: canRegister.waitingList, id: member.id, invited: canRegister.invited }))
                } else {
                    // Add waiting list
                    if (canRegister.waitingList) {
                        suggestions.push(new Suggestion({ group, member, waitingList: true, id: member.id, invited: false }))
                    }
                }
            }
        }

        // If a given member can register for multiple groups, only show one and remove the group
        const filteredSuggestions: Suggestion[] = []
        for (const suggestion of suggestions) {
            const existing = filteredSuggestions.find(s => s.member.id == suggestion.member.id && !s.invited)
            if (existing && !suggestion.invited) {
                existing.merge(suggestion)
                continue
            }
            filteredSuggestions.push(suggestion)
        }

        // Remove non specific groups
        for (const suggestion of filteredSuggestions) {
            if (suggestion.invited) {
                continue;
            }

            if (suggestion.member.activeRegistrations.length == 0) {
                // Okay to suggest
                continue;
            }
            if (suggestion.group && (suggestion.group.settings.requireGroupIds.length > 0 || (suggestion.group.settings.minAge !== null && suggestion.group.settings.maxAge !== null))) {
                // Okay to suggest
                continue;
            }
            // Remove group
            suggestion.group = undefined
        }

        return filteredSuggestions
    }
}