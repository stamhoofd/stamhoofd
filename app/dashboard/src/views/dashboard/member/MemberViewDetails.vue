<template>
    <div class="member-view-details">
        <div>
            <div class="hover-box">
                <h2 class="style-with-button">
                    <div>Algemeen</div>
                    <div class="hover-show"><button class="button icon gray edit" @click="editMember()"></button></div>
                </h2>
                <dl class="details-grid">
                    <dt>Verjaardag</dt>
                    <dd>{{ member.details.birthDayFormatted }} ({{ member.details.age }} jaar)</dd>

                    <template v-if="member.groups.length > 0">
                        <dt>Groep</dt>
                        <dd class="hover-box">
                            {{ member.groups.map(g => g.settings.name).join(", ") }}
                            <button class="hover-show button icon gray edit" @click="editGroup()"></button>
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
                </dl>
                </div>

            <hr>

            <div v-for="(parent, index) in member.details.parents" :key="index" class="hover-box">
                <h2 class="style-with-button">
                    <div>{{ ParentTypeHelper.getName(parent.type) }}</div>
                    <div class="hover-show"><button class="button icon gray edit" @click="editParent(parent)"></button></div>
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

                <hr>
            </div>

            <div v-for="(contact, index) in member.details.emergencyContacts" :key="'contact-' + index" class="hover-box">
                <h2 class="style-with-button">
                    <div>{{ contact.title }}</div>
                    <div class="hover-show"><button class="button icon gray edit" @click="editContact(contact)"></button></div>
                </h2>

                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ contact.name }}</dd>

                    <dt>GSM-nummer</dt>
                    <dd>{{ contact.phone }}</dd>
                </dl>

                <hr v-if="index < member.details.emergencyContacts.length - 1">
            </div>

            <div v-if="member.details.doctor" class="hover-box">
                <hr>

                <h2 class="style-with-button">
                    <div>Huisarts</div>
                    <div class="hover-show"><button class="button icon gray edit" @click="editContact(member.details.doctor)"></button></div>
                </h2>

                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ member.details.doctor.name }}</dd>

                    <dt>Telefoonnummer</dt>
                    <dd>{{ member.details.doctor.phone }}</dd>
                </dl>
            </div>

            <div v-if="familyMembers.length > 0" class="hover-box">
                <hr>

                <h2 class="style-with-button">
                    <div v-if="member.details.age <= 30 && familyMembers[0].details.age <= 30">Broers &amp; zussen</div>
                    <div v-else>Familie</div>
                </h2>

                <STList>
                    <STListItem v-for="familyMember in familyMembers" :key="familyMember.id" :selectable="true" @click="gotoMember(familyMember)">
                        <h3 class="style-title-list">{{ familyMember.firstName }} {{ familyMember.details ? familyMember.details.lastName : "" }}</h3>
                        <p class="style-description">{{ familyMember.groups.map(g => g.settings.name).join(", ") }}</p>
                        <span class="icon arrow-right-small gray" slot="right" />
                    </STListItem>
                </STList>
            </div>

        </div>

        <div v-if="member.groups.length > 0" class="hover-box">
            <h2 class="style-with-button">
                <div>
                    <span class="icon-spacer">Steekkaart</span><span
                        v-tooltip="
                            'De steekkaart kan gevoelige gegevens bevatten. Spring hier uiterst zorgzaam mee om en kijk de privacyvoorwaarden van jouw vereniging na.'
                        "
                        class="icon gray privacy"
                    />
                </div>
                <div class="hover-show"><button class="button icon gray edit" @click="editMemberRecords()"></button></div>
            </h2>

            <ul class="member-records">
                <li
                    v-for="(record, index) in member.details.records"
                    :key="index"
                    :class="{ more: canOpenRecord(record), [RecordTypeHelper.getPriority(record.type)]: true}"
                    @click="openRecordView(record)"
                    v-tooltip="record.description.length > 0 ? record.description : null"
                >
                    <span :class="'icon '+getIcon(record)"/>
                    <span class="text">{{ record.getText() }}</span>
                    <span class="icon arrow-right-small" v-if="canOpenRecord(record)" />
                </li>
            </ul>

            <p class="info-box" v-if="member.details.records.length == 0">{{ member.details.firstName }} heeft niets speciaal aangeduid op de steekkaart</p>

            <template v-if="false">
                <hr>

                <h2><span class="icon-spacer">Notities</span><button class="button privacy" /></h2>
                <p>Voeg notities toe voor je medeleiding. Leden of ouders krijgen deze niet te zien.</p>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin, ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { TooltipDirective as Tooltip, ErrorBox, STList, STListItem } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";
import { RecordTypeHelper, ParentTypeHelper, MemberWithRegistrations, Record, RecordTypePriority, Parent, EmergencyContact } from '@stamhoofd/structures';
import RecordDescriptionView from './records/RecordDescriptionView.vue';
import EditMemberView from './edit/EditMemberView.vue';
import EditMemberParentView from './edit/EditMemberParentView.vue';
import { FamilyManager } from '../../../classes/FamilyManager';
import EditMemberEmergencyContactView from './edit/EditMemberEmergencyContactView.vue';
import MemberView from './MemberView.vue';
import EditMemberGroupView from './edit/EditMemberGroupView.vue';

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
}

.details-grid {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: 8px 15px;

    dt {
        @extend .style-definition-term;
    }

    dd {
        @extend .style-definition-description;
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
