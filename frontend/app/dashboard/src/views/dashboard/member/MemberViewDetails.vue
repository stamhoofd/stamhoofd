<template>
    <div class="member-view-details split">
        <div>
            <div v-if="$isMobile && hasWarnings" class="hover-box container">
                <ul class="member-records">
                    <li
                        v-for="warning in sortedWarnings"
                        :key="warning.id"
                        :class="{ [warning.type]: true }"
                    >
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>
            </div>

            <div class="hover-box container">
                <hr v-if="($isMobile && hasWarnings)">
                <dl class="details-grid hover">
                    <template v-if="member.details.firstName">
                        <dt>Voornaam</dt>
                        <dd v-copyable>
                            {{ member.details.firstName }}
                        </dd>
                    </template>

                    <template v-if="member.details.lastName">
                        <dt>Achternaam</dt>
                        <dd v-copyable>
                            {{ member.details.lastName }}
                        </dd>
                    </template>

                    <template v-if="member.details.memberNumber">
                        <dt>Lidnummer</dt>
                        <dd v-copyable>
                            {{ member.details.memberNumber }}
                        </dd>
                    </template>

                    <template v-if="member.details.birthDay">
                        <dt>Verjaardag</dt>
                        <dd v-copyable>
                            {{ member.details.birthDayFormatted }} ({{ member.details.age }} jaar)
                        </dd>
                    </template>

                    <template v-if="member.details.phone">
                        <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
                        <dd v-copyable>
                            {{ member.details.phone }}
                        </dd>
                    </template>

                    <template v-if="member.details.email">
                        <dt>E-mailadres</dt>
                        <dd v-copyable>
                            {{ member.details.email }}
                            <span v-if="getInvalidEmailDescription(member.details.email)" v-tooltip="getInvalidEmailDescription(member.details.email)" class="icon warning yellow" />
                        </dd>
                    </template>

                    <template v-if="member.details.address">
                        <dt>Adres</dt>
                        <dd v-copyable>
                            {{ member.details.address.street }} {{ member.details.address.number }}<br>{{ member.details.address.postalCode }}
                            {{ member.details.address.city }}
                            <template v-if="member.details.address.country !== currentCountry">
                                <br>{{ formatCountry(member.details.address.country) }}
                            </template>
                        </dd>
                    </template>
                </dl>
            </div>

            <div class="container">
                <hr>
                <h2 class="style-with-button">
                    <button v-long-press="(e) => switchCycle(e)" type="button" class="button" @click.prevent="switchCycle" @contextmenu.prevent="switchCycle">
                        {{ visibleRegistrationsTitle }}
                        <span class="icon arrow-down-small" />
                    </button>
                    <div>
                        <button v-if="hasWrite" v-long-press="(e) => addRegistration(e)" type="button" class="button icon add gray" @click.prevent="addRegistration" @contextmenu.prevent="addRegistration" />
                    </div>
                </h2>

                <p v-if="visibleRegistrations.length == 0 && cycleOffset == 0" class="info-box">
                    {{ member.firstName }} is niet ingeschreven
                </p>
                <p v-else-if="visibleRegistrations.length == 0" class="info-box">
                    {{ member.firstName }} was niet ingeschreven
                </p>

                <STList v-if="hasWrite">
                    <MemberRegistrationBlock v-for="registration in visibleRegistrations" :key="registration.id" :registration="registration" @edit="(e) => editRegistration(registration, e)" />
                </STList>
                <STList v-else>
                    <MemberRegistrationBlock v-for="registration in visibleRegistrations" :key="registration.id" :registration="registration" />
                </STList>
            </div>

            <div v-for="parent in member.details.parents" :key="'parent-'+parent.id" class="hover-box container">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
                    <div class="hover-show">
                        <button v-if="hasWrite" class="button icon gray edit" type="button" @click="editParent(parent)" />
                    </div>
                </h2>

                <dl class="details-grid hover">
                    <dt>Naam</dt>
                    <dd v-copyable>
                        {{ parent.name }}
                    </dd>

                    <template v-if="parent.phone">
                        <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
                        <dd v-copyable>
                            {{ parent.phone }}
                        </dd>
                    </template>

                    <template v-if="parent.email">
                        <dt>E-mailadres</dt>
                        <dd v-copyable>
                            {{ parent.email }}
                            <span v-if="getInvalidEmailDescription(parent.email)" v-tooltip="getInvalidEmailDescription(parent.email)" class="icon warning yellow" />
                        </dd>
                    </template>

                    <template v-if="parent.address">
                        <dt>Adres</dt>
                        <dd v-copyable>
                            {{ parent.address.street }} {{ parent.address.number }}<br>{{ parent.address.postalCode }}
                            {{ parent.address.city }}
                            <template v-if="parent.address.country !== currentCountry">
                                <br>{{ formatCountry(parent.address.country) }}
                            </template>
                        </dd>
                    </template>
                </dl>
            </div>

            <div v-for="(contact, index) in member.details.emergencyContacts" :key="'contact-' + index" class="hover-box container">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ contact.title }}</div>
                    <div class="hover-show">
                        <button v-if="hasWrite" type="button" class="button icon gray edit" @click="editContact(contact)" />
                    </div>
                </h2>

                <dl class="details-grid hover">
                    <dt>Naam</dt>
                    <dd v-copyable>
                        {{ contact.name }}
                    </dd>

                    <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
                    <dd v-copyable>
                        {{ contact.phone }}
                    </dd>
                </dl>
            </div>

            <div v-if="member.details.doctor" class="hover-box container">
                <hr>
                <h2 class="style-with-button">
                    <div>Huisarts</div>
                    <div class="hover-show">
                        <button v-if="hasWrite" type="button" class="button icon gray edit" @click="editContact(member.details.doctor)" />
                    </div>
                </h2>

                <dl class="details-grid hover">
                    <template v-if="member.details.doctor.name">
                        <dt>Naam</dt>
                        <dd v-copyable>
                            {{ member.details.doctor.name }}
                        </dd>
                    </template>

                    <template v-if="member.details.doctor.phone">
                        <dt>Telefoonnummer</dt>
                        <dd v-copyable>
                            {{ member.details.doctor.phone }}
                        </dd>
                    </template>
                </dl>
            </div>

            <!-- Loop all records -->
            <div v-for="category in recordCategories" :key="'category-'+category.id" class="hover-box container">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ category.name }}</div>
                    <div class="hover-show">
                        <button v-if="hasWrite" type="button" class="button icon gray edit" @click="editRecordCategory(category)" />
                    </div>
                </h2>
                <RecordCategoryAnswersBox :category="category" :answers="member.details.recordAnswers" :data-permission="true" />
            </div>

            <!-- Loop all records -->
            <div v-if="missingAnswers.length > 0" class="hover-box container">
                <hr>
                <h2 class="style-with-button">
                    <div>Overige kenmerken</div>
                </h2>
                <p>Deze kenmerken werden opgeslagen bij dit lid, maar bestaan niet langer of zijn niet meer van toepassing. Je kan ze verwijderen.</p>
                <RecordCategoryAnswersBox :answers="missingAnswers" :data-permission="dataPermission" :can-delete="true" @delete="deleteRecord($event)" />
            </div>
        </div>

        <div v-if="(hasWarnings && !$isMobile) || member.users.length > 0 || familyMembers.length > 0">
            <div v-if="hasWarnings && !$isMobile" class="hover-box container">
                <ul class="member-records">
                    <li
                        v-for="warning in sortedWarnings"
                        :key="warning.id"
                        :class="{ [warning.type]: true }"
                    >
                        <span :class="'icon '+warning.icon" />
                        <span class="text">{{ warning.text }}</span>
                    </li>
                </ul>

                <template v-if="member.users.length > 0">
                    <hr>
                </template>
            </div>

            <div v-if="member.users.length > 0" class="hover-box container">
                <hr v-if="$isMobile">
                <h2 class="style-with-button">
                    <span class="icon-spacer">Accounts</span>
                    <a 
                        v-if="!$isTouch"
                        class="button icon gray help"
                        target="_blank"
                        :href="'https://'+$t('shared.domains.marketing')+'/docs/leden-beheren-met-meerdere-ouders/'"
                    />
                </h2>

                <STList>
                    <STListItem v-for="user in member.users" :key="user.id" class="hover-box">
                        <template v-if="user.hasAccount && user.verified" #left><span class="icon user small" /></template>
                        <template v-else-if="user.hasAccount && !user.verified" #left><span v-tooltip="'Deze gebruiker moet het e-mailadres nog verifiëren.'" class="icon email small" /></template>
                        <template v-else #left><span v-tooltip="'Deze gebruiker moet eerst registreren op dit emailadres en daarbij een wachtwoord instellen.'" class="icon email small" /></template>

                        <template v-if="user.firstName || user.lastName">
                            <h3 v-if="user.firstName || user.lastName" class="style-title-list">
                                {{ user.firstName }} {{ user.lastName }}
                            </h3>
                            <p class="style-description-small">
                                {{ user.email }}
                            </p>
                        </template>
                        <h3 v-else class="style-title-list">
                            {{ user.email }}
                        </h3>

                        <p v-if="!user.hasAccount" class="style-description-small">
                            Kan registreren
                        </p>

                        <p v-else-if="!user.verified" class="style-description-small">
                            E-mailadres nog niet geverifieerd
                        </p>

                        <p v-if="user.permissions" class="style-description-small">
                            Beheerder
                        </p>

                        <template v-if="getInvalidEmailDescription(user.email)" #right><span v-tooltip="getInvalidEmailDescription(user.email)" class="icon warning yellow" /></template>
                        <template v-if="isOldEmail(user.email)" #right><button class="button icon trash hover-show" type="button" @click="unlinkUser(user)" /></template>
                    </STListItem>
                </STList>
            </div>

            <div v-if="familyMembers.length > 0" class="hover-box container">
                <hr>
                <h2>
                    <template v-if="member.details.age <= 30 && Math.abs(maxFamilyAge - member.details.age) <= 14">
                        Broers &amp; zussen
                    </template>
                    <template v-else>
                        Familie
                    </template>
                </h2>

                <STList>
                    <STListItem v-for="familyMember in familyMembers" :key="familyMember.id" :selectable="true" @click="gotoMember(familyMember)">
                        <template #left><span class="icon user small" /></template>
                        <h3 class="style-title-list">
                            {{ familyMember.firstName }} {{ familyMember.details ? familyMember.details.lastName : "" }}
                        </h3>
                        <p v-if="familyMember.groups.length > 0" class="style-description-small">
                            {{ familyMember.groups.map(g => g.settings.name).join(", ") }}
                        </p>
                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>
                </STList>
            </div>

            <div v-if="false" class="hover-box container">
                <hr>

                <h2><span class="icon-spacer">Notities</span><button type="button" class="button privacy" /></h2>
                <p>Voeg notities toe voor je medeleiding. Leden of ouders krijgen deze niet te zien.</p>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ContextMenu, ContextMenuItem, CopyableDirective, ErrorBox, FillRecordCategoryView, LongPressDirective, RecordCategoryAnswersBox, STList, STListItem, TableActionsContextMenu, Toast, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Country, CountryHelper, DataPermissionsSettings, EmailInformation, EmergencyContact, EncryptedMemberWithRegistrations, FinancialSupportSettings, MemberDetailsWithGroups, MemberWithRegistrations, Parent, ParentTypeHelper, RecordAnswer, RecordCategory, RecordSettings, RecordWarning, RecordWarningType, Registration, User } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { MemberManager } from "../../../classes/MemberManager";

import { MemberActionBuilder } from "../groups/MemberActionBuilder";
import EditMemberEmergencyContactView from './edit/EditMemberEmergencyContactView.vue';
import EditMemberParentView from './edit/EditMemberParentView.vue';
import EditMemberView from './edit/EditMemberView.vue';
import MemberRegistrationBlock from './MemberRegistrationBlock.vue';
import MemberView from './MemberView.vue';

@Component({
    components: {
        STListItem,
        STList,
        RecordCategoryAnswersBox,
        MemberRegistrationBlock
    },
    directives: { 
        Tooltip, 
        Copyable: CopyableDirective, 
        LongPress: LongPressDirective
    },
    filters: {
        dateTime: Formatter.dateTime.bind(Formatter)
    },
})
export default class MemberViewDetails extends Mixins(NavigationMixin) {
    @Prop()
        member!: MemberWithRegistrations;

    @Prop()
        familyManager!: FamilyManager;

    loadingComplete = false

    checkingBounces = false
    emailInformation: EmailInformation[] = []

    created() {
        (this as any).ParentTypeHelper = ParentTypeHelper;
        this.checkBounces().catch(e => console.error(e))
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    get currentCountry() {
        return this.$organization.address.country
    }

    formatCountry(country: Country) {
        return CountryHelper.getName(country)
    }

    get recordCategories(): RecordCategory[] {
        return RecordCategory.flattenCategoriesForAnswers(
            this.$organization.meta.recordsConfiguration.recordCategories, 
            this.member.details.recordAnswers
        )
    }

    get missingAnswers(): RecordAnswer[] {
        const missing: RecordAnswer[] = []
        for (const answer of this.member.details.recordAnswers) {
            // Search
            if (!this.recordCategories.find(cat => !!cat.records.find(record => record.id === answer.settings.id))) {
                missing.push(answer)
            }
        }
        return missing
    }

    async deleteRecord(record: RecordSettings) {
        if (!await CenteredMessage.confirm("Dit kenmerk verwijderen?", "Ja, verwijderen", "Je kan dit niet ongedaan maken")) {
            return
        }
        const index = this.member.details.recordAnswers.findIndex(r => r.settings.id == record.id)
        if (index !== -1) {
            this.member.details.recordAnswers.splice(index, 1)
            await this.familyManager.patchAllMembersWith(this.member)
        }
    }

    get dataPermission() {
        return this.member.details.dataPermissions?.value ?? false
    }

    get visibleRegistrationsTitle() {
        if (this.cycleOffset === 0) {
            return 'Inschrijvingen';
        }
        if (this.cycleOffset === 1) {
            return 'Vorige inschrijvingsperiode';
        }

        return 'Inschrijvingen '+this.cycleOffset+' periodes geleden';
    }

    get visibleRegistrations() {
        return this.member.filterRegistrations({cycleOffset: this.cycleOffset})
    }

    get hasWarnings() {
        return this.warnings.length > 0
    }

    get warnings(): RecordWarning[] {
        const warnings: RecordWarning[] = []

        for (const answer of this.member.details.recordAnswers) {
            warnings.push(...answer.getWarnings())
        }

        if (this.$organization.meta.recordsConfiguration.financialSupport) {
            if (this.member.details.requiresFinancialSupport && this.member.details.requiresFinancialSupport.value) {
                warnings.push(RecordWarning.create({
                    text: this.$organization.meta.recordsConfiguration.financialSupport?.warningText || FinancialSupportSettings.defaultWarningText,
                    type: RecordWarningType.Error
                }))
            }
        }
        
        if (this.$organization.meta.recordsConfiguration.dataPermission) {
            if (this.member.details.dataPermissions && !this.member.details.dataPermissions.value) {
                warnings.push(RecordWarning.create({
                    text: this.$organization.meta.recordsConfiguration.dataPermission?.warningText || DataPermissionsSettings.defaultWarningText,
                    type: RecordWarningType.Error
                }))
            }
        }

        return warnings
    }

    get sortedWarnings() {
        return this.warnings.slice().sort(RecordWarning.sort)
    }

    editRecordCategory(category: RecordCategory) {
        const displayedComponent = new ComponentWithProperties(FillRecordCategoryView, {
            category,
            answers: this.member.details.recordAnswers,
            markReviewed: false,
            hasNextStep: false,
            dataPermission: this.member.details.dataPermissions?.value ?? false,
            filterDefinitions: MemberDetailsWithGroups.getFilterDefinitions(this.$organization, {member: this.member}),
            filterValueForAnswers: (answers) => {
                const details = this.member.details.patch({
                    recordAnswers: answers
                });
                return new MemberDetailsWithGroups(details, this.member, [])
            },
            saveHandler: async (answers: RecordAnswer[], component: NavigationMixin) => {
                this.member.details.recordAnswers = answers
                await this.familyManager.patchAllMembersWith(this.member)
                component.dismiss({ force: true })
            }
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }

    get hasWrite(): boolean {
        if (!this.$organizationManager.user.permissions) {
            return false
        }

        if (this.$organizationManager.user.permissions.hasWriteAccess(this.$organization.privateMeta?.roles ?? [])) {
            // Can edit members without groups
            return true
        }

        for (const group of this.member.groups) {
            if(group.privateSettings && group.hasWriteAccess(this.$organizationManager.user.permissions, this.$organization)) {
                return true
            }
        }
        
        return false
    }

    getInvalidEmailDescription(email: string) {
        const find = this.emailInformation.find(e => e.email === email)
        if (!find) {
            return null
        }
        if (find.markedAsSpam) {
            return "Heeft e-mail als spam gemarkeerd"
        }
        if (find.hardBounce) {
            return "Ongeldig e-mailadres"
        }
        return null
    }

    async checkBounces() {
        if (this.checkingBounces) {
            return
        }
        this.checkingBounces = true
        const emails = this.member.getAllEmails()

        if (emails.length > 0) {
            try {
                const response = await this.$context.authenticatedServer.request({
                    method: "POST",
                    path: "/email/check-bounces",
                    body: emails,
                    decoder: new ArrayDecoder(EmailInformation as Decoder<EmailInformation>),
                    owner: this
                })
                this.emailInformation = response.data
            } catch (e) {
                console.error(e)
            }
        }

        this.checkingBounces = false
    }

    async markAsComplete() {
        if (this.loadingComplete) {
            return
        }
        if (!await CenteredMessage.confirm("Ben je zeker dat je alle onbereikbare gegevens wilt verwijderen?", "Ja, verwijderen")) {
            return
        }
        this.loadingComplete = true
        try {
            // Mark this member as complete again
            this.member.details.isRecovered = false
            await this.familyManager.patchAllMembersWith(this.member)
        } catch (e) {
            // Reset
            this.member.details.isRecovered = true
            console.error(e)
            Toast.fromError(e).show()
        }
        this.loadingComplete = false
    }

    isOldEmail(email: string) {
        return !(this.member.details?.getManagerEmails().includes(email) ?? false)
    }

    isUnlinkingUser = false

    /**
     * You can only unlink a user if the e-mail is not in the manager emails of the member (or it will get readded automatically)
     */
    async unlinkUser(user: User) {
        if (this.isUnlinkingUser) {
            return
        }
        if (!await CenteredMessage.confirm("Ben je zeker dat je de toegang tot dit lid wilt intrekken voor dit account?", "Ja, verwijderen", "Toegang intrekken van: "+user.email)) {
            return
        }

        this.isUnlinkingUser = true

        try {
            // Update the users that are connected to these members
            const encryptedMembers: PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations> = this.$memberManager.getMembersAccessPatch([this.member])

            // Add delete user
            const missing: PatchableArrayAutoEncoder<User> = new PatchableArray()
            missing.addDelete(user.id)
            encryptedMembers.addPatch(
                EncryptedMemberWithRegistrations.patch({
                    id: this.member.id,
                    users: missing
                })
            )

            await this.$memberManager.patchMembersAndSync([this.member], encryptedMembers, false)
        } catch (e) {
            // Reset
            console.error(e)
            Toast.fromError(e).show()
        }

        this.isUnlinkingUser = false
    }

    gotoMember(member: MemberWithRegistrations) {
        const component = new ComponentWithProperties(MemberView, {
            member: member,
        }).setDisplayStyle("popup");
        this.present(component);
    }

    editContact(contact: EmergencyContact) {
        const familyManager = this.familyManager
        const displayedComponent = new ComponentWithProperties(EditMemberEmergencyContactView, {
            memberDetails: this.member.details,
            familyManager,
            contact,
            handler: async (parent: Parent, component) => {
                if (component.loading) {
                    return;
                }
                component.loading = true;
                component.errorBox = null;

                try {
                    await familyManager.patchAllMembersWith(this.member)
                    component.loading = false
                    component.pop({ force: true })
                } catch (e) {
                    component.errorBox = new ErrorBox(e)
                    component.loading = false
                }
                
            }
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }

    editParent(parent: Parent) {
        const familyManager = this.familyManager
        const displayedComponent = new ComponentWithProperties(EditMemberParentView, {
            memberDetails: this.member.details,
            familyManager,
            parent,
            handler: async (parent: Parent, component) => {
                if (component.loading) {
                    return;
                }
                component.loading = true;
                familyManager.updateParent(parent)

                component.errorBox = null;

                try {
                    await familyManager.patchAllMembersWith(this.member)
                    component.loading = false
                    component.pop({ force: true })
                } catch (e) {
                    component.errorBox = new ErrorBox(e)
                    component.loading = false
                }
                
            }
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }

    editMember() {
        const displayedComponent = new ComponentWithProperties(EditMemberView, {
            member: this.member,
            initialFamily: this.familyManager
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }

    cycleOffset = 0;

    switchCycle(event) {
        let maxCycle = 1;
        for (const registration of this.member.registrations) {
            const group = this.member.allGroups.find(g => g.id === registration.groupId)
            if (group) {
                const offset = group.cycle - registration.cycle;
                if (offset > maxCycle) {
                    maxCycle = offset;
                }
            }
        }

        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: "Huidige inschrijvingsperiode",
                    selected: this.cycleOffset === 0,
                    action: () => {
                        this.cycleOffset = 0;
                        return true;
                    }
                }),
                // Repeat maxCycle times
                ...Array.from({ length: maxCycle }, (_, i) => i + 1).map(i => new ContextMenuItem({
                    name: `${i === 1 ? 'Vorige' : i} inschrijvingsperiode${i >= 2 ? 's geleden' : ''}`,
                    selected: this.cycleOffset === i,
                    action: () => {
                        this.cycleOffset = i;
                        return true;
                    }
                }))
            ],
        ])
        menu.show({ button: event.currentTarget, yOffset: -10 }).catch(console.error)
    }

    addRegistration(event) {
        const el = event.currentTarget;
        const bounds = el.getBoundingClientRect()

        const builder = new MemberActionBuilder({
            $organizationManager: this.$organizationManager,
            $memberManager: this.$memberManager,
            component: this,
            groups: this.member.groups,
            cycleOffset: 0,
            inWaitingList: false,
            hasWrite: this.hasWrite,
        })

        const actions = builder.getRegisterActions(this.cycleOffset)

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: bounds.left,
            y: bounds.bottom,
            xPlacement: "right",
            yPlacement: "bottom",
            actions: actions,
            selection: {
                hasSelection: true,
                isSingle: true,
                getSelection: () => [this.member]
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    editRegistration(registration: Registration, event) {
        const group = this.member.allGroups.find(g => g.id === registration.groupId)
        if (!group) {
            return
        }

        const builder = new MemberActionBuilder({
            $organizationManager: this.$organizationManager,
            $memberManager: this.$memberManager,
            component: this,
            groups: [group],
            cycleOffset: group.cycle - registration.cycle,
            inWaitingList: registration.waitingList,
            hasWrite: this.hasWrite,
        })

        const actions = [
            builder.getUnsubscribeAction().setGroupIndex(0).setPriority(10),
            builder.getMoveAction().setGroupIndex(1).setPriority(5),
            ...builder.getWaitingListActions()
        ]

        const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
            x: event.changedTouches ? event.changedTouches[0].pageX : event.clientX,
            y: event.changedTouches ? event.changedTouches[0].pageY : event.clientY,
            xPlacement: "right",
            yPlacement: "bottom",
            actions: actions,
            selection: {
                isSingle: true,
                hasSelection: true,
                getSelection: () => {
                    return [this.member]
                }
            }
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    get familyMembers() {
        return this.familyManager.members.filter(m => m.id != this.member.id)
    }

    get maxFamilyAge() {
        const ages = this.familyMembers.map(m => m.details.age ?? 99)
        if (ages.length == 0) {
            return 99
        }
        return Math.max(...ages)
    }
}
</script>