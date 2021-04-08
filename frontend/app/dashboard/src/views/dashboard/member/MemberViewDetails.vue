<template>
    <div class="member-view-details">
        <div>
            <p v-if="member.activeRegistrations.length == 0" class="info-box with-button selectable" @click="editGroup()">
                {{ member.firstName }} is niet ingeschreven
                <span class="button icon edit" />
            </p>

            <div class="hover-box">
                <h2 class="style-with-button">
                    <div>Algemeen</div>
                    <div class="hover-show">
                        <button v-if="hasWrite" class="button icon gray edit" @click="editMember()" />
                    </div>
                </h2>
                <dl class="details-grid">
                    <template v-if="member.details.memberNumber">
                        <dt>Lidnummer</dt>
                        <dd>{{ member.details.memberNumber }}</dd>
                    </template>

                    <template v-if="member.details.birthDay">
                        <dt>Verjaardag</dt>
                        <dd>{{ member.details.birthDayFormatted }} ({{ member.details.age }} jaar)</dd>
                    </template>

                    <template v-if="member.details.phone">
                        <dt>GSM-nummer</dt>
                        <dd>{{ member.details.phone }}</dd>
                    </template>

                    <template v-if="member.details.email">
                        <dt>E-mailadres</dt>
                        <dd>{{ member.details.email }}</dd>
                    </template>

                    <template v-if="member.details.address">
                        <dt>Adres</dt>
                        <dd>
                            {{ member.details.address.street }} {{ member.details.address.number }}<br>{{ member.details.address.postalCode }}
                            {{ member.details.address.city }}
                        </dd>
                    </template>
                </dl>
            </div>

            <div v-if="member.activeRegistrations.length > 0" class="container">
                <hr>
                <h2 class="style-with-button with-list">
                    <div>Ingeschreven voor</div>
                    <div>
                        <button class="button text limit-space" @click="editGroup()">
                            <span class="icon sync" />
                            <span>Wijzig</span>
                        </button>
                    </div>
                </h2>

                <STList>
                    <STListItem v-for="registration in member.activeRegistrations" :key="registration.id" class="left-center">
                        <figure v-if="imageSrc(registration)" slot="left" class="registration-image">
                            <img :src="imageSrc(registration)">
                            <div>
                                <span v-if="!registration.waitingList" class="icon green success" />
                                <span v-else class="icon gray clock" />
                            </div>
                        </figure>
                        <figure v-else slot="left" class="registration-image">
                            <figure>
                                <span>{{ getGroup(registration.groupId).settings.name.substr(0, 2) }}</span>
                            </figure>
                            <div>
                                <span v-if="!registration.waitingList" class="icon green success" />
                                <span v-else class="icon gray clock" />
                            </div>
                        </figure>
                        <h3 class="style-title-list">
                            {{ getGroup(registration.groupId).settings.name }}
                        </h3>
                        <p v-if="!registration.waitingList" class="style-description-small">
                            Ingeschreven op {{ registration.registeredAt | dateTime }}
                        </p>
                        <p v-else class="style-description-small">
                            Op wachtlijst sinds {{ registration.createdAt | dateTime }}
                        </p>
                    </STListItem>
                </STList>
            </div>

            <div v-for="(parent, index) in member.details.parents" :key="index" class="hover-box">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
                    <div class="hover-show">
                        <button v-if="hasWrite" class="button icon gray edit" @click="editParent(parent)" />
                    </div>
                </h2>

                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ parent.name }}</dd>

                    <template v-if="parent.phone">
                        <dt>GSM-nummer</dt>
                        <dd>{{ parent.phone }}</dd>
                    </template>

                    <template v-if="parent.email">
                        <dt>E-mailadres</dt>
                        <dd>{{ parent.email }}</dd>
                    </template>

                    <template v-if="parent.address">
                        <dt>Adres</dt>
                        <dd>
                            {{ parent.address.street }} {{ parent.address.number }}<br>{{ parent.address.postalCode }}
                            {{ parent.address.city }}
                        </dd>
                    </template>
                </dl>
            </div>

            <div v-for="(contact, index) in member.details.emergencyContacts" :key="'contact-' + index" class="hover-box">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ contact.title }}</div>
                    <div class="hover-show">
                        <button v-if="hasWrite" class="button icon gray edit" @click="editContact(contact)" />
                    </div>
                </h2>

                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ contact.name }}</dd>

                    <dt>GSM-nummer</dt>
                    <dd>{{ contact.phone }}</dd>
                </dl>
            </div>

            <div v-if="member.details.doctor" class="hover-box">
                <hr>
                <h2 class="style-with-button">
                    <div>Huisarts</div>
                    <div class="hover-show">
                        <button v-if="hasWrite" class="button icon gray edit" @click="editContact(member.details.doctor)" />
                    </div>
                </h2>

                <dl class="details-grid">
                    <template v-if="member.details.doctor.name">
                        <dt>Naam</dt>
                        <dd>{{ member.details.doctor.name }}</dd>
                    </template>

                    <template v-if="member.details.doctor.phone">
                        <dt>Telefoonnummer</dt>
                        <dd>{{ member.details.doctor.phone }}</dd>
                    </template>
                </dl>
            </div>

            <div v-if="familyMembers.length > 0" class="hover-box">
                <hr>

                <h2 class="style-with-button">
                    <div v-if="member.details.age <= 30 && familyMembers[0].details.age <= 30">
                        Broers &amp; zussen
                    </div>
                    <div v-else>
                        Familie
                    </div>
                </h2>

                <STList>
                    <STListItem v-for="familyMember in familyMembers" :key="familyMember.id" :selectable="true" @click="gotoMember(familyMember)">
                        <h3 class="style-title-list">
                            {{ familyMember.firstName }} {{ familyMember.details ? familyMember.details.lastName : "" }}
                        </h3>
                        <p class="style-description">
                            {{ familyMember.groups.map(g => g.settings.name).join(", ") }}
                        </p>
                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>
            </div>

            <div v-if="!member.details || member.details.isRecovered">
                <hr>
                <p v-if="!hasLatestKey" class="error-box">
                    Een deel van de gegevens van dit lid is versleuteld met een sleutel die je niet hebt — en is dus onleesbaar voor jou. Vraag een hoofdbeheerder - die deze sleutel wel heeft - om jou terug toegang te geven (dat kan in instellingen > beheerders > jouw naam > encryptiesleutels > toegang geven).
                </p>
                <p v-else class="error-box">
                    Een deel van de gegevens van dit lid is nog versleuteld met een oude sleutel die je niet hebt — en is dus onleesbaar voor jou. Je kan aan een hoofdbeheerder - die deze sleutel wel heeft - vragen om die ook met jou te delen (dat kan in instellingen > beheerders > jouw naam > encryptiesleutels > toegang geven). Of je kan de gegevens terug aanvullen (of laten aanvullen) en de oude onbereikbare gegevens verwijderen om deze melding weg te halen.
                </p>
                <hr v-if="hasLatestKey">
                <button v-if="hasLatestKey" class="button destructive" @click="markAsComplete">
                    <span class="icon trash" />
                    <span>Verwijder versleutelde gegevens</span>
                </button>
            </div>
        </div>

        <div v-if="(member.details && (!member.details.isRecovered || member.details.records.length > 0) && !shouldSkipRecords) || member.users.length > 0" class="hover-box">
            <template v-if="(member.details && (!member.details.isRecovered || member.details.records.length > 0) && !shouldSkipRecords)">
                <h2 class="style-with-button">
                    <div>
                        <span class="icon-spacer">Steekkaart</span><span
                            v-tooltip="
                                'De steekkaart kan gevoelige gegevens bevatten. Spring hier uiterst zorgzaam mee om en kijk de privacyvoorwaarden van jouw vereniging na.'
                            "
                            class="icon gray privacy"
                        />
                    </div>
                    <div class="hover-show">
                        <button v-if="hasWrite" class="button icon gray edit" @click="editMemberRecords()" />
                    </div>
                </h2>

                <ul class="member-records">
                    <li
                        v-for="(record, index) in sortedRecords"
                        :key="index"
                        v-tooltip="record.description.length > 0 ? record.description : null"
                        :class="{ more: canOpenRecord(record), [RecordTypeHelper.getPriority(record.type)]: true}"
                        @click="openRecordView(record)"
                    >
                        <span :class="'icon '+getIcon(record)" />
                        <span class="text">{{ record.getText() }}</span>
                        <span v-if="canOpenRecord(record)" class="icon arrow-right-small" />
                    </li>
                </ul>

                <p v-if="sortedRecords.length == 0" class="info-box">
                    {{ member.details.firstName }} heeft niets speciaal aangeduid op de steekkaart
                </p>

                <template v-if="member.users.length > 0">
                    <hr>
                </template>
            </template>

            <template v-if="activeAccounts.length > 0">
                <h2>
                    <span class="icon-spacer">Accounts</span><span
                        v-tooltip="
                            'Deze accounts bestaan, kunnen inloggen en hebben toegang tot dit lid. Je kan toegang intrekken door het e-mailadres eerst te verwijderen uit alle gegevens van dit lid, daarna kan je op het vuilbakje klikken.'
                        "
                        class="icon gray help"
                    />
                </h2>
                <p v-for="user in activeAccounts" :key="user.id" class="account hover-box">
                    <span>{{ user.email }}</span>
                    <button v-if="isOldEmail(user.email)" class="button icon trash hover-show" />
                </p>
            </template>

            <template v-if="placeholderAccounts.length > 0">
                <h2>
                    <span class="icon-spacer">Kunnen registereren</span><span
                        v-tooltip="
                            'Nieuwe accounts met één van deze e-mailadressen krijgen automatisch toegang tot dit lid (registreren kan op inschrijvingspagina). Deze worden automatisch bepaald aan de hand van de gegevens van het lid.'
                        "
                        class="icon gray help"
                    />
                </h2>
                <p v-for="user in placeholderAccounts" :key="user.id" class="account">
                    {{ user.email }}
                </p>
            </template>

            <template v-if="false">
                <hr>

                <h2><span class="icon-spacer">Notities</span><button class="button privacy" /></h2>
                <p>Voeg notities toe voor je medeleiding. Leden of ouders krijgen deze niet te zien.</p>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, STList, STListItem,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { Keychain } from "@stamhoofd/networking";
import { EmergencyContact,getPermissionLevelNumber,MemberWithRegistrations, Parent, ParentTypeHelper, PermissionLevel, Record, RecordType, RecordTypeHelper, RecordTypePriority, Registration } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins,Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { OrganizationManager } from "../../../classes/OrganizationManager";
import EditMemberEmergencyContactView from './edit/EditMemberEmergencyContactView.vue';
import EditMemberGroupView from './edit/EditMemberGroupView.vue';
import EditMemberParentView from './edit/EditMemberParentView.vue';
import EditMemberView from './edit/EditMemberView.vue';
import MemberView from './MemberView.vue';
import RecordDescriptionView from './records/RecordDescriptionView.vue';

@Component({
    components: {
        STListItem,
        STList
    },
    directives: { Tooltip },
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

    created() {
        (this as any).ParentTypeHelper = ParentTypeHelper;
        (this as any).RecordTypeHelper = RecordTypeHelper;
    }

    getGroup(groupId: string) {
        return OrganizationManager.organization.groups.find(g => g.id === groupId)
    }

    imageSrc(registration: Registration) {
        const group = this.getGroup(registration.groupId)
        if (!group) {
            return null
        }
        return (group.settings.squarePhoto ?? group.settings.coverPhoto)?.getPathForSize(100, 100)
    }

    get hasLatestKey() {
        return Keychain.hasItem(OrganizationManager.organization.publicKey)
    }

    get hasWrite(): boolean {
        if (!OrganizationManager.user.permissions) {
            return false
        }

        for (const group of this.member.groups) {
            if(group.privateSettings && getPermissionLevelNumber(group.privateSettings.permissions.getPermissionLevel(OrganizationManager.user.permissions)) >= getPermissionLevelNumber(PermissionLevel.Write)) {
                return true
            }
        }
        
        return false
    }

    get activeAccounts() {
        return this.member.users.filter(u => u.publicKey !== null)
    }

    get placeholderAccounts() {
        return this.member.users.filter(u => u.publicKey === null)
    }

    get shouldSkipRecords() {
        return (OrganizationManager.organization.meta.recordsConfiguration.shouldSkipRecords(this.member.details?.age ?? null))
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
        }
        this.loadingComplete = false
    }

    isOldEmail(email: string) {
        return !(this.member.details?.getManagerEmails().includes(email) ?? false)
    }

    gotoMember(member: MemberWithRegistrations) {
        const component = new ComponentWithProperties(MemberView, {
            member: member,
        }).setDisplayStyle("popup");
        this.present(component);
    }

    canOpenRecord(record: Record) {
        if (record.description.length > 0) {
            return true;
        }
        if (RecordTypeHelper.getInternalDescription(record.type)) {
            return true;
        }
        if (RecordTypeHelper.getInternalLinks(record.type).length > 0) {
            return true;
        }
        return false;
    }

    getIcon(record: Record) {
        switch (RecordTypeHelper.getPriority(record.type)) {
            case RecordTypePriority.High: return " exclamation-two red"
            case RecordTypePriority.Medium: return " exclamation yellow"
            case RecordTypePriority.Low: return " info"
        }
    }

    openRecordView(record: Record) {
        this.show(new ComponentWithProperties(RecordDescriptionView, {
            member: this.member,
            record
        }))
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

    editGroup() {
        const displayedComponent = new ComponentWithProperties(EditMemberGroupView, {
            member: this.member,
            memberDetails: this.member.details,
            familyManager: this.familyManager
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }

    editMemberRecords() {
        const displayedComponent = new ComponentWithProperties(EditMemberView, {
            member: this.member,
            initialFamily: this.familyManager,
            initialTabIndex: 2
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }

    get familyMembers() {
        return this.familyManager.members.filter(m => m.id != this.member.id)
    }

    get filteredRecords() {
        return this.member.details?.records ? 
            OrganizationManager.organization.meta.recordsConfiguration.filterForDisplay(
                this.member.details.records, 
                this.member.details?.age ?? null
            ) 
        : undefined
    }

    get sortedRecords() {
        return this.filteredRecords?.sort((record1, record2) => {
            const priority1: string = RecordTypeHelper.getPriority(record1.type);
            const priority2: string = RecordTypeHelper.getPriority(record2.type)

            if (priority1 == RecordTypePriority.High && priority2 == RecordTypePriority.Medium ||
                priority1 == RecordTypePriority.Medium && priority2 == RecordTypePriority.Low ||
                priority1 == RecordTypePriority.High && priority2 == RecordTypePriority.Low) {
                return -1;
            }
            else if (priority1 == RecordTypePriority.Low && priority2 == RecordTypePriority.Medium ||
                priority1 == RecordTypePriority.Medium && priority2 == RecordTypePriority.High ||
                priority1 == RecordTypePriority.Low && priority2 == RecordTypePriority.High) {
                return 1;
            }
            else {
                return 0;
            }
        } )
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/components/member-details.scss";
</style>
