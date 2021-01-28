<template>
    <div class="member-view-details">
        <div>
            <div class="hover-box">
                <h2 class="style-with-button">
                    <div>Algemeen</div>
                    <div class="hover-show">
                        <button class="button icon gray edit" @click="editMember()" />
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

                    <template v-if="member.groups.length > 0">
                        <dt>Groep</dt>
                        <dd class="hover-box">
                            {{ member.groups.map(g => g.settings.name).join(", ") }}
                            <button class="hover-show button icon gray sync" @click="editGroup()" />
                        </dd>
                    </template>

                    <template v-if="member.waitingGroups.length > 0">
                        <dt>Wachtlijst</dt>
                        <dd>{{ member.waitingGroups.map(g => g.settings.name).join(", ") }}</dd>
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

            <div v-for="(parent, index) in member.details.parents" :key="index" class="hover-box">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
                    <div class="hover-show">
                        <button class="button icon gray edit" @click="editParent(parent)" />
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
                        <button class="button icon gray edit" @click="editContact(contact)" />
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
                        <button class="button icon gray edit" @click="editContact(member.details.doctor)" />
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
        </div>

        <div v-if="(member.details && !member.details.isPlaceholder) || member.users.length > 0" class="hover-box">
            <template v-if="(member.details && !member.details.isPlaceholder)">
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
                        <button class="button icon gray edit" @click="editMemberRecords()" />
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
        <div v-if="!member.details || member.details.isPlaceholder">
            <p class="error-box">
                Enkel de voornaam en enkele andere gegevens zijn beschikbaar omdat je geen toegang meer hebt tot de encryptiesleutel van de vereniging die door dit lid gebruikt werd. Vraag een administrator om jou terug toegang te geven (dat kan in beheerders > jouw naam > encryptiesleutels > toegang geven).
            </p>
        </div>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STListItem,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { EmergencyContact,MemberWithRegistrations, Parent, ParentTypeHelper, Record, RecordType, RecordTypeHelper, RecordTypePriority } from '@stamhoofd/structures';
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
})
export default class MemberViewDetails extends Mixins(NavigationMixin) {
    @Prop()
    member!: MemberWithRegistrations;

    @Prop()
    familyManager!: FamilyManager;

    created() {
        (this as any).ParentTypeHelper = ParentTypeHelper;
        (this as any).RecordTypeHelper = RecordTypeHelper;
    }

    get activeAccounts() {
        return this.member.users.filter(u => u.publicKey !== null)
    }

    get placeholderAccounts() {
        return this.member.users.filter(u => u.publicKey === null)
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
        OrganizationManager.organization.meta.recordsConfiguration.filterRecords(
            Record.invertRecords(this.member.details.records), 
            ...(OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(RecordType.GroupPicturePermissions) ? [RecordType.PicturePermissions] : [])
        ).filter((record) => {
            // Some edge cases
            // Note: inverted types are already reverted here! -> GroupPicturePermissions means no permissions here
            
            if (record.type === RecordType.GroupPicturePermissions) {
                // When both group and normal pictures are allowed, hide the group pictures message
                if (OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(RecordType.PicturePermissions) && this.member.details?.records.find(r => r.type === RecordType.PicturePermissions)) {
                    // Permissions for pictures -> this is okay
                    return false
                }

                if (!OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(RecordType.PicturePermissions)) {
                    // This is not a special case
                    return false
                }
            }

            // If no permissions for pictures but permissions for group pictures, only show the group message
            if (record.type === RecordType.PicturePermissions) {
                if (OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(RecordType.GroupPicturePermissions) && this.member.details?.records.find(r => r.type === RecordType.GroupPicturePermissions)) {
                    // Only show the 'only permissions for group pictures' banner
                    return false
                }
            }


            // Member is older than 18 years, and no permissions for medicines
            if (record.type === RecordType.MedicinePermissions && (this.member.details?.age ?? 18) >= 18) {
                return false
            }

            return true
        }) : undefined
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
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.member-view-details {
    padding: 10px 0;
    padding-bottom: 30px;
    display: grid;
    grid-template-columns: 60% 40%;
    gap: 20px;

    @media (max-width: 700px) {
        grid-template-columns: 100%;
    }

    > div,
    > div > div {
        --st-horizontal-padding: 0;
        
        > h2 {
            @extend .style-title-2;
            margin: 20px 0;
        }

        > p {
            &:not([class]) {
                @extend .style-definition-description;
            }
        }

        > hr {
            height: $border-width;
            border: 0;
            outline: 0;
            width: 100%;
            background: $color-gray-lighter;
            border-radius: $border-width/2;
            margin: 30px 0;
        }
    }

    .accounts-description {
        @extend .style-definition-description;
        margin-top: 15px;
    }

    .account {
        @extend .style-definition-description;
        margin-bottom: 5px;
    }
}

.member-records {
    li {
        list-style: none;
        padding: 0 10px;
        background: $color-white-shade;
        border-radius: $border-radius;
        margin: 6px 0;
        @extend .style-definition-description;
        display: flex;
        flex-direction: row;
        align-items: center;
        vertical-align: middle;

        &.High {
            background: $color-error-background;
            color: $color-error-dark;
        }

        &.Medium {
            background: $color-warning-background;
            color: $color-warning-dark;
        }

        .icon:first-child {
            margin-right: 5px;
            flex-shrink: 0;
        }

        .text {
            padding: 11px 0;
        }

        &.more {
            cursor: help;

            .icon:last-child {
                display: block;
                flex-shrink: 0;
                margin-left: auto;
                padding-left: 5px;
                transform: translate(0, 0);
                opacity: 0.5;
                transition: transform 0.2s, opacity 0.2s;
            }

            &:hover {
                .icon:last-child {
                    transform: translate(5px, 0);
                    opacity: 1;
                }
            }
        }
    }
}
</style>
