<template>
    <div id="parent-view" class="st-view">
        <STNavigationBar title="Inschrijvingen wijzigen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon gray close" @click="pop" />
        </STNavigationBar>
        
        <main>
            <h1>
                Inschrijvingen wijzigen
            </h1>
            <p>Kies alle inschrijvingsgroepen waarvoor je dit lid wilt inschrijven. Kijk de betaalstatus na voor je iets wijzigt, want die kan Stamhoofd zelf niet automatisch wijzigen (en bij uitschrijven gaat die informatie verloren). Na de wijziging kan je het te betalen lidgeld eventueel manueel wijzigen.</p>

            <div v-if="canGoBack || canGoNext" class="history-navigation-bar">
                <button v-if="canGoBack" class="button text gray" @click="goBack">
                    <span class="icon arrow-left" />
                    <span>Vorige inschrijvingsperiode</span>
                </button>

                <button v-if="canGoNext" class="button text gray" @click="goNext">
                    <span>Volgende inschrijvingsperiode</span>
                    <span class="icon arrow-right" />
                </button>
            </div>

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

                        <button v-if="category.settings.maximumRegistrations === 1 && getSelectedGroupForCategory(category) && getSelectedGroupForCategory(category).id === group.id" slot="right" class="button text gray" @click.stop.prevent="setSelectedGroupForCategory(category, null)">
                            <span class="icon trash" />
                            <span>Verwijderen</span>
                        </button>
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar>
            <template v-if="pendingRegistrations.length > 0" slot="left">
                {{ pendingRegistrations.length }} {{ pendingRegistrations.length == 1 ? 'wijziging' : 'wijzigingen' }}
            </template>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" @click="save">
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
import { AddressInput, BackButton, CenteredMessage, Checkbox, EmailInput, ErrorBox, LoadingButton, PhoneInput, Radio, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast,Validator } from "@stamhoofd/components"
import { Group,GroupCategoryTree,MemberDetails } from "@stamhoofd/structures"
import { MemberWithRegistrations } from '@stamhoofd/structures';
import { Registration } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../../classes/FamilyManager';
import { OrganizationManager } from '../../../../classes/OrganizationManager';

class PendingRegistration {
    replace: Registration | null = null
    group: Group
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
        LoadingButton
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

    mounted() {
        this.groups = OrganizationManager.organization.groups

        if (!this.member) {
            // Select matching groups
            for (const category of this.categoryTree.categories) {
                if (category.settings.maximumRegistrations === 1) {
                    // Select the first matching one
                    const matching = this.memberDetails.getMatchingGroups(category.groups)[0] ?? null
                    if (matching) {
                        this.setSelectedGroupForCategory(category, matching)
                    }
                }
            }
        }
    }

    get canGoBack() {
        // todo
        return true
    }

    get canGoNext() {
        return this.cycleOffset > 0
    }

    goNext() {
        this.cycleOffset--
    }

    goBack() {
        this.cycleOffset++
    }

    get categoryTree() {
        return OrganizationManager.organization.getCategoryTreeWithDepth(1).filterForDisplay(true, OrganizationManager.organization.meta.packages.useActivities)
    }

    getSelectedGroupForCategory(category: GroupCategoryTree): Group | null {
        let group: Group | null = null

        // Check normal registrations
        if (this.member) {
            for (const registration of this.member.registrations) {
                const g = category.groups.find(gg => gg.id === registration.groupId)
                if (g && !registration.waitingList && registration.registeredAt !== null && registration.deactivatedAt === null && registration.cycle === g.cycle - this.cycleOffset) {
                    // Found a result
                    group = g
                }
            }
        }
        
        // Check pending ones
        for (const reg of this.pendingRegistrations) {
            const g = category.groups.find(gg => gg.id === reg.group.id)
            if (g && reg.cycle === g.cycle - this.cycleOffset) {
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
                    newPending.push(new PendingRegistration(g, g.cycle - this.cycleOffset, replace, true))
                } else {
                    console.warn("Group not found when trying to mark registration for deletion")
                }
            }
        } else {
            if (replace && replace.groupId === group.id) {
                // No change needed to existing registrations
            } else {
                newPending.push(new PendingRegistration(group, group.cycle - this.cycleOffset, replace))
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
                if (registration.groupId === group.id && !registration.waitingList && registration.registeredAt !== null && registration.deactivatedAt === null && registration.cycle === group.cycle - this.cycleOffset) {
                    // Found a result
                    selected = true
                }
            }
        }
        
        // Check pending ones
        for (const reg of this.pendingRegistrations) {
            if (reg.group.id === group.id && reg.cycle === group.cycle - this.cycleOffset) {
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
                newPending.push(new PendingRegistration(group, group.cycle - this.cycleOffset, replace))
            }
        } else {
            if (replace) {
                // Add delete
                newPending.push(new PendingRegistration(group, group.cycle - this.cycleOffset, replace, true))
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
                        }))
                        continue
                    }
                    patchRegistrations.addPut(
                        Registration.create({
                            groupId: change.group.id,
                            cycle: change.cycle,
                            waitingList: false,
                            payment: null,
                            registeredAt: new Date()
                        })
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
                    registrations.push(
                        Registration.create({
                            groupId: change.group.id,
                            cycle: change.cycle,
                            waitingList: false,
                            payment: null,
                            registeredAt: new Date()
                        })
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;


</style>
