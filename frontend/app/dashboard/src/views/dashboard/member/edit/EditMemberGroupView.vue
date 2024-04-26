<template>
    <div id="parent-view" class="st-view">
        <STNavigationBar title="Inschrijvingen" :dismiss="canDismiss" :pop="canPop" />
        
        <main>
            <h1>
                Waarvoor wil je {{ memberDetails.firstName }} inschrijven?
            </h1>

            <SegmentedControl v-model="waitingList" :items="tabs" :labels="tabLabels" />

            <STErrorsDefault :error-box="errorBox" />
            <div v-for="category in categoryTree.categories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.settings.name }}</h2>
                <STList>
                    <STListItem v-for="group in category.groups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio v-if="category.settings.maximumRegistrations === 1" slot="left" :name="'choose-group'+category.id" :value="group" :model-value="getSelectedGroupForCategory(category)" @change="setSelectedGroupForCategory(category, $event)" />
                        <Checkbox v-else slot="left" :checked="getSelectedGroup(group)" @change="setSelectedGroup(group, $event)" />
                        <h2 class="style-title-list">
                            {{ group.settings.name }}
                        </h2>

                        <button v-if="category.settings.maximumRegistrations === 1 && getSelectedGroupForCategory(category) && getSelectedGroupForCategory(category).id === group.id" slot="right" type="button" class="button text gray" @click.stop.prevent="setSelectedGroupForCategory(category, null)">
                            <span class="icon trash" />
                            <span>Verwijderen</span>
                        </button>
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar>
            <template v-if="pendingRegistrations.length > 0 && !isNew" slot="left">
                {{ pendingRegistrations.length }} {{ pendingRegistrations.length == 1 ? 'wijziging' : 'wijzigingen' }}
            </template>
            <template v-else-if="pendingRegistrations.length > 0" slot="left">
                {{ pendingRegistrations.length }} {{ pendingRegistrations.length == 1 ? 'inschrijving' : 'inschrijvingen' }}
            </template>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" type="button" @click="save">
                    Opslaan
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, CenteredMessage, Checkbox, EmailInput, ErrorBox, LoadingButton, PhoneInput, Radio, SegmentedControl, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupCategoryTree, MemberDetails, MemberWithRegistrations, RegisterCartPriceCalculator, RegisterCartValidator, Registration, UnknownMemberWithRegistrations } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../../classes/FamilyManager';



class PendingRegistration {
    replace: Registration | null = null
    group: Group
    waitingList = false
    cycle = 0
    delete = false

    constructor(group: Group, cycle: number, replace: Registration | null = null, doDelete = false) {
        this.group = group
        this.cycle = cycle
        this.replace = replace
        this.delete = doDelete
    }
}

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        Radio,
        PhoneInput,
        EmailInput,
        Checkbox,
        STList,
        STListItem,
        BackButton,
        LoadingButton,
        SegmentedControl
    }
})
export default class EditMemberGroupView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        memberDetails: MemberDetails

    @Prop({ default: null })
        member: MemberWithRegistrations | null

    @Prop({ required: true })
        familyManager: FamilyManager

    groups: Group[] = []

    errorBox: ErrorBox | null = null
    loading = false
    validator = new Validator()

    cycleOffset = 0

    pendingRegistrations: PendingRegistration[] = []

    tabs = [false, true];
    tabLabels = ["Groepen", "Wachtlijsten"];
    waitingList = false;

    mounted() {
        this.groups = this.$organization.groups
    }

    get isNew() {
        return !this.member
    }

    get suggestedTree() {
        return this.$organization.getCategoryTree({
            maxDepth: 1, 
            permissions: this.$user!.permissions, 
            smartCombine: true, // don't concat group names with multiple levels if all categories only contain one group
            filterGroups: g => {
                const member: UnknownMemberWithRegistrations = this.member ?? {
                    id: '',
                    registrations: [],
                    details: this.memberDetails
                }
                const canRegister = RegisterCartValidator.canRegister(member, g, this.familyManager.members, this.$organization.getGroupsForPermissions(this.$organizationManager.user?.permissions), this.$organization.availableCategories, [])
                return !canRegister.closed || canRegister.waitingList
            }
        })
    }

    get categoryTree() {
        return this.$organization.getCategoryTree({maxDepth: 1, smartCombine: true, permissions: this.$context.user?.permissions})
    }

    getSelectedGroupForCategory(category: GroupCategoryTree): Group | null {
        let group: Group | null = null

        // Check normal registrations
        if (this.member) {
            for (const registration of this.member.registrations) {
                const g = category.groups.find(gg => gg.id === registration.groupId)
                if (g && registration.waitingList === this.waitingList && registration.registeredAt !== null && registration.deactivatedAt === null && registration.cycle === g.cycle - this.cycleOffset) {
                    // Found a result
                    group = g
                }
            }
        }
        
        // Check pending ones
        for (const reg of this.pendingRegistrations) {
            const g = category.groups.find(gg => gg.id === reg.group.id)
            if (g && reg.cycle === g.cycle - this.cycleOffset && reg.waitingList === this.waitingList) {
                if (reg.delete) {
                    // Was deleted
                    if (group && group.id === g.id) {
                        group = null
                    }
                } else {
                    // Found a result
                    group = g
                }
                
            }
        }

        return group
    }

    setSelectedGroupForCategory(category: GroupCategoryTree, group: Group | null) {
        // Delete pending ones
        const newPending: PendingRegistration[] = []
        for (const reg of this.pendingRegistrations) {
            const g = category.groups.find(gg => gg.id === reg.group.id)
            if (g && reg.cycle === g.cycle - this.cycleOffset) {
                // delete
            } else {
                newPending.push(reg)
            }
        }

        // Check if we need to replace one
        let replace: Registration | null = null
        if (this.member) {
            for (const registration of this.member.registrations) {
                const g = category.groups.find(gg => gg.id === registration.groupId)
                if (g && registration.cycle === g.cycle - this.cycleOffset) {
                    // Found a result
                    replace = registration
                    break
                }
            }
        }

        if (group === null) {
            // Delete
            if (replace) {
                // Add explicit delete
                const g = category.groups.find(gg => gg.id === replace!.groupId)
                if (g) {
                    const p = new PendingRegistration(g, g.cycle - this.cycleOffset, replace, true)
                    p.waitingList = this.waitingList
                    newPending.push(p)
                } else {
                    console.warn("Group not found when trying to mark registration for deletion")
                }
            }
        } else {
            if (replace && replace.groupId === group.id) {
                // No change needed to existing registrations
            } else {
                const p = new PendingRegistration(group, group.cycle - this.cycleOffset, replace)
                p.waitingList = this.waitingList
                newPending.push(p)
            }
        }

        this.pendingRegistrations = newPending
        console.log(newPending)
    }

    getSelectedGroup(group: Group): boolean {
        let selected = false

        // Check normal registrations
        if (this.member) {
            for (const registration of this.member.registrations) {
                if (registration.groupId === group.id && registration.waitingList === this.waitingList && registration.registeredAt !== null && registration.deactivatedAt === null && registration.cycle === group.cycle - this.cycleOffset) {
                    // Found a result
                    selected = true
                }
            }
        }
        
        // Check pending ones
        for (const reg of this.pendingRegistrations) {
            if (reg.group.id === group.id && reg.cycle === group.cycle - this.cycleOffset && reg.waitingList === this.waitingList) {
                if (reg.delete) {
                    // Was deleted
                    selected = false
                } else {
                    // Found a result
                    selected = true
                }
                
            }
        }

        return selected
    }

    setSelectedGroup(group: Group, selected: boolean) {
        // Delete pending ones
        const newPending: PendingRegistration[] = []
        for (const reg of this.pendingRegistrations) {
            if (reg.group && reg.group.id === group.id && reg.cycle === group.cycle - this.cycleOffset) {
                // delete
            } else {
                newPending.push(reg)
            }
        }

        // Check if we need to replace one
        let replace: Registration | null = null
        if (this.member) {
            for (const registration of this.member.registrations) {
                if (registration.groupId === group.id && registration.cycle === group.cycle - this.cycleOffset) {
                    // Found a result
                    replace = registration
                    break
                }
            }
        }

        if (selected) {
            if (replace) {
                // No change needed
            } else {
                const p = new PendingRegistration(group, group.cycle - this.cycleOffset, replace)
                p.waitingList = this.waitingList
                newPending.push(p)
            }
        } else {
            if (replace) {
                // Add delete
                const p = new PendingRegistration(group, group.cycle - this.cycleOffset, replace, true)
                p.waitingList = this.waitingList
                newPending.push(p)
            } else {
                // No change needed
            }
        }

        this.pendingRegistrations = newPending
        console.log(newPending)
    }

    async save() {
        if (this.loading) {
            return;
        }
        if (!this.memberDetails) {
            return false;
        }

        this.loading = true
        
        try {
            if (this.member) {
                // Get an active registration
                const notChanged = this.pendingRegistrations.length == 0
                if (notChanged) {
                    this.loading = false;
                    this.dismiss({ force: true })
                    return true;
                }

                const patchRegistrations: PatchableArrayAutoEncoder<Registration> = new PatchableArray()

                for (const change of this.pendingRegistrations) {
                    if (change.delete) {
                        patchRegistrations.addDelete(change.replace!.id)
                        continue
                    }
                    if (change.replace) {
                        patchRegistrations.addPatch(Registration.patch({
                            id: change.replace.id,
                            groupId: change.group.id,
                            cycle: change.cycle,
                            waitingList: change.waitingList,
                        }))
                        continue
                    }


                    const registration = Registration.create({
                        groupId: change.group.id,
                        cycle: change.cycle,
                        waitingList: change.waitingList,
                        registeredAt: new Date()
                    })

                    registration.price = RegisterCartPriceCalculator.calculateSinglePrice(this.member, registration, this.familyManager.members, this.$organization.groups, this.$organization.meta.categories)
                    patchRegistrations.addPut(
                        registration
                    )
                }

                await this.familyManager.patchMemberRegistrations(this.member, patchRegistrations);
                new Toast("De inschrijvingen van "+this.memberDetails.firstName+" zijn gewijzigd", "success green").show()
            } else {
                const registrations: Registration[] = []
                for (const change of this.pendingRegistrations) {
                    if (change.delete) {
                        // Not supported
                        continue
                    }
                    if (change.replace) {
                        // not supported
                        continue
                    }

                    const registration = Registration.create({
                        groupId: change.group.id,
                        cycle: change.cycle,
                        waitingList: change.waitingList,
                        //payment: null,
                        registeredAt: new Date()
                    });

                    registration.price = RegisterCartPriceCalculator.calculateSinglePriceForNewMember(this.memberDetails, registration, this.familyManager.members, this.$organization.groups, this.$organization.meta.categories)
                    registrations.push(
                        registration
                    )
                }

                if (registrations.length === 0) {
                    throw new SimpleError({
                        code: "missing_registrations",
                        message: "No registrations selected",
                        human: "Kies ten minste één inschrijvingsgroep"
                    })
                }
                
                await this.familyManager.addMember(this.memberDetails, registrations)
                new Toast(this.memberDetails.firstName+' is toegevoegd', "success green").show()
            }
          
            this.errorBox = null
            this.loading = false;
            this.dismiss({ force: true })
            return true
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            this.loading = false;
            return false;
        }
    }

    async shouldNavigateAway() {
        if (this.pendingRegistrations.length == 0) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

}
</script>