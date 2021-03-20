<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.name">
            <template slot="left">
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>
        
        <main>
            <h1>
                <span>{{ member.name }}</span>
                <span v-if="member.activeRegistrations.length == 0" class="style-tag error">Nog niet ingeschreven</span>
            </h1>

            <div class="member-view-details">
                <div>
                    <p v-if="member.details.isRecovered" class="warning-box">
                        Een deel van de gegevens van dit lid zijn versleuteld (zie onderaan) en momenteel (voor jou) onleesbaar. Dit komt omdat je een nieuw account hebt aangemaakt of omdat je jouw wachtwoord was vergeten. Je kan de gegevens momenteel niet nakijken, maar je ontvangt een mailtje zodra we jou manueel toegang hebben gegeven. Je kan nu ook gewoon alles opnieuw ingeven als je niet wilt wachten.
                    </p>

                    <div class="hover-box container">
                        <h2 class="style-with-button">
                            <div>Ingeschreven voor</div>
                            <div class="hover-show">
                                <button class="button text limit-space" @click="chooseGroups()">
                                    <span class="icon add" />
                                    <span>Inschrijven</span>
                                </button>
                            </div>
                        </h2>

                        <STList>
                            <STListItem v-for="registration in member.activeRegistrations" :key="registration.id">
                                <figure slot="left" v-if="imageSrc(registration)" class="registration-image">
                                    <img :src="imageSrc(registration)">
                                    <div>
                                        <span v-if="!registration.waitingList" class="icon green success" />
                                        <span v-else class="icon gray clock" />
                                    </div>
                                </figure>
                                <span v-else slot="left" class="icon green success" />
                                <h3 class="style-title-list">{{ getGroup(registration.groupId).settings.name }}</h3>
                                <p class="style-description-small">Ingeschreven op {{ registration.registeredAt | dateTime }}</p>
                                <p class="style-description-small" v-if="registration.waitingList">Op wachtlijst</p>
                            </STListItem>

                        </STList>
                        <hr>

                    </div>


                    <div class="hover-box container">
                        <h2 class="style-with-button">
                            <div>Algemeen</div>
                            <div class="hover-show">
                                <button class="button text limit-space" @click="editGeneral()">
                                    <span class="icon edit" />
                                    <span>Bewerken</span>
                                </button>
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

                    <div v-if="parents.length > 0" class="hover-box container">
                        <hr>
                        <h2 class="style-with-button">
                            <div>Ouders</div>
                            <div class="hover-show">
                                <button class="button text limit-space" @click.stop="editParents()">
                                    <span class="icon edit" />
                                    <span>Bewerken</span>
                                </button>
                            </div>
                        </h2>
                        <STList>
                            <STListItem v-for="parent in parents" :key="parent.id">
                                <h2 class="style-title-list">
                                    {{ parent.firstName }} {{ parent.lastName }}
                                </h2>
                                <p v-if="parent.phone" class="style-description-small">
                                    {{ parent.phone }}
                                </p>
                                <p v-if="parent.email" class="style-description-small">
                                    {{ parent.email }}
                                </p>
                                <p v-if="parent.address" class="style-description-small">
                                    {{ parent.address }}
                                </p>
                            </STListItem>
                        </STList>
                    </div>

                    <div v-for="(contact, index) in member.details.emergencyContacts" :key="'contact-' + index" class="hover-box">
                        <hr>
                        <h2 class="style-with-button">
                            <div>Noodcontact: {{ contact.title }}</div>
                            <div class="hover-show">
                                <button class="button icon gray edit" @click="editEmergencyContact(contact)" />
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
                                <button class="button icon gray edit" @click="editRecords()" />
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


                    <hr>
                    <h2>Hoe worden deze gegevens bewaard?</h2>

                    <p>Om de gegevens van onze leden te beschermen, worden deze end-to-end versleuteld opgeslagen. We plaatsen ze dus in een kluis, waar het computersysteem niet in kan. Normaal heb je toegang tot de sleutel van deze kluis, maar je kan deze kwijt geraken als: je jouw wachtwoord vergeet of een nieuw account aanmaakt. We kunnen deze sleutel terug met jou delen, op voorwaarde dat je een account hebt met een wachtwoord dat je kent. Dus zodra je een nieuw wachtwoord hebt gekozen, krijgen wij een melding en kunnen wij op een wiskundig veilige manier de sleutel bij jou brengen zonder dat het computersysteem deze kan lezen. Beetje ingewikkeld, maar op die manier zijn de gegevens van onze leden zo veilig mogelijk opgeslagen.</p>
                </div>
                <div v-if="(!member.details.isRecovered || member.details.records.length > 0) && !shouldSkipRecords" class="hover-box">
                    <template v-if="((!member.details.isRecovered || member.details.records.length > 0) && !shouldSkipRecords)">
                        <h2 class="style-with-button">
                            <div>
                                <span class="icon-spacer">Steekkaart</span><span
                                    v-tooltip="
                                        'De steekkaart kan gevoelige gegevens bevatten. Ze worden — net zoals de meeste gegevens — end-to-end versleuteld opgeslagen.'
                                    "
                                    class="icon gray privacy"
                                />
                            </div>
                            <div class="hover-show">
                                <button class="button icon gray edit" @click="editRecords()" />
                            </div>
                        </h2>

                        <ul class="member-records">
                            <li
                                v-for="(record, index) in sortedRecords"
                                :key="index"
                                v-tooltip="record.description.length > 0 ? record.description : null"
                                :class="{ [RecordTypeHelper.getPriority(record.type)]: true}"
                            >
                                <span :class="'icon '+getIcon(record)" />
                                <span class="text">{{ record.getText() }}</span>
                            </li>
                        </ul>

                        <p v-if="sortedRecords.length == 0" class="info-box">
                            {{ member.details.firstName }} heeft niets aangeduid op de steekkaart
                        </p>
                    </template>
                </div>
            </div>
        </main>

        <STToolbar>
            <button slot="right" class="primary button" @click="chooseGroups">
                <span class="icon add" />
                <span>Inschrijven</span>
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox, STList, STListItem, STNavigationBar, STToolbar, TooltipDirective as Tooltip } from "@stamhoofd/components"
import { MemberWithRegistrations, Parent, Record,RecordTypeHelper, RecordTypePriority, Registration } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../classes/OrganizationManager";
import GroupTree from "../../components/GroupTree.vue";
import { EditMemberStepsManager, EditMemberStepType } from "./details/EditMemberStepsManager";
import MemberChooseGroupsView from "./MemberChooseGroupsView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        GroupTree
    },
    filters: {
        price: Formatter.price,
        dateTime: Formatter.dateTime.bind(Formatter)
    },
    directives: { Tooltip },
})
export default class MemberView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    member!: MemberWithRegistrations

    RecordTypeHelper = RecordTypeHelper

    async editGeneral() {
        await this.openSteps([EditMemberStepType.Details])
    }

    async editParents() {
        await this.openSteps([EditMemberStepType.Parents])
    }

    async editRecords() {
        await this.openSteps([EditMemberStepType.Records])
    }

    async editEmergencyContact() {
        await this.openSteps([EditMemberStepType.EmergencyContact])
    }    

    async openSteps(steps: EditMemberStepType[]) {
        const stepManager = new EditMemberStepsManager(
            steps, 
            this.member,
            (component: NavigationMixin) => {
                component.dismiss({ force: true })
                return Promise.resolve()
            }
        )
        const component = await stepManager.getFirstComponent()

        if (!component) {
            // Weird
        } else {
            this.present(new ComponentWithProperties(NavigationController, {
                root: component
            }).setDisplayStyle("popup"))
        }
    }

    get parents() {
        return this.member.details?.parents ?? []
    }

    getGroup(groupId: string) {
        return OrganizationManager.organization.groups.find(g => g.id === groupId)
    }

    chooseGroups() {
        this.show(new ComponentWithProperties(MemberChooseGroupsView, {
            member: this.member
        }))
    }

    editParent(parent: Parent) {
        /*this.present(new ComponentWithProperties(ParentView, {
            memberDetails: this.member.details,
            parent,
            handler: (parent: Parent, component: ParentView) => {
                component.pop({ force: true })
                // todo! SAVE HERE!
                //this.checkNewParents()
            }
        }).setDisplayStyle("popup"))*/
    }

    imageSrc(registration: Registration) {
        const group = this.getGroup(registration.groupId)
        if (!group) {
            return null
        }
        return (group.settings.squarePhoto ?? group.settings.coverPhoto)?.getPathForSize(100, 100)
    }

    getIcon(record: Record) {
        switch (RecordTypeHelper.getPriority(record.type)) {
            case RecordTypePriority.High: return " exclamation-two red"
            case RecordTypePriority.Medium: return " exclamation yellow"
            case RecordTypePriority.Low: return " info"
        }
    }

    get shouldSkipRecords() {
        return (OrganizationManager.organization.meta.recordsConfiguration.shouldSkipRecords(this.member.details?.age ?? null))
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
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

@use "@stamhoofd/scss/components/member-details.scss";

.member-view .registration-image {
    position: relative;

    img {
        width: 60px;
        height: 60px;
        border-radius: $border-radius;
        object-fit: cover;

        @media (max-width: 350px) {
            width: 40px;
            height: 40px;
        }
    }

    div {
        position: absolute;
        right: 0;
        bottom: 0;
        background: white;
        border-radius: 40px;
        line-height: 24px;
        transform: translate(40%, 30%);
        height: 23px; // alignment fix for centered icons

        display: flex;
        vertical-align: middle;
        align-items: center;
        justify-content: center;
    }
}
</style>