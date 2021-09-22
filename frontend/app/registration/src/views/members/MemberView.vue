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

            <p v-if="member.details.isRecovered" class="warning-box">
                Een deel van de gegevens van dit lid zijn versleuteld (zie uitleg onderaan) en momenteel (voor jou) onleesbaar. Dit komt omdat je een nieuw account hebt aangemaakt of omdat je jouw wachtwoord was vergeten. Je kan de gegevens momenteel niet allemaal bekijken tot we jou terug toegang hebben gegeven of tot je zelf alles terug ingeeft.
            </p>

            <div class="member-view-details">
                <div>
                    <div v-if="member.activeRegistrations.length > 0" class="container">
                        <h2 class="style-with-button with-list">
                            <div>Ingeschreven voor</div>
                            <div>
                                <button class="button text limit-space" @click="chooseGroups()">
                                    <span class="icon add" />
                                    <span>Inschrijven</span>
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
                        <hr>
                    </div>


                    <div v-if="member.details.phone || member.details.email || member.details.address || member.details.birthDay || member.details.memberNumber" class="container">
                        <h2 class="style-with-button">
                            <div>Algemeen</div>
                            <div>
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
                        <hr>
                    </div>

                    <div v-if="parents.length > 0" class="container">
                        <h2 class="style-with-button">
                            <div>Ouders</div>
                            <div>
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
                        <hr>
                    </div>

                    <div v-for="(contact, index) in member.details.emergencyContacts" :key="'contact-' + index">
                        <h2 class="style-with-button">
                            <div>Noodcontact: {{ contact.title }}</div>
                            <div>
                                <button class="button text limit-space" @click.stop="editEmergencyContact(contact)">
                                    <span class="icon edit" />
                                    <span>Bewerken</span>
                                </button>
                            </div>
                        </h2>

                        <dl class="details-grid">
                            <dt>Naam</dt>
                            <dd>{{ contact.name }}</dd>

                            <dt>GSM-nummer</dt>
                            <dd>{{ contact.phone }}</dd>
                        </dl>
                        <hr>
                    </div>

                    <div v-if="member.details.doctor">
                        <h2 class="style-with-button">
                            <div>Huisarts</div>
                            <div>
                                <button class="button text limit-space" @click="editRecords()">
                                    <span class="icon edit" />
                                    <span>Bewerken</span>
                                </button>
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
                        <hr>
                    </div>

                    <h2>Gegevens worden end-to-end versleuteld</h2>

                    <p>Om de gegevens van onze leden te beschermen, worden alle gegevens (met uitzondering van de voornaam van het lid en de e-mailadressen) end-to-end versleuteld opgeslagen: we plaatsen ze in een digitale kluis waar het computersysteem niet in kan. Normaal heb je toegang tot de digitale sleutel (dit gebeurt automatisch) van deze kluis, maar je kan deze kwijt geraken als je jouw wachtwoord vergeet of een nieuw account aanmaakt. We kunnen deze sleutel terug met jou delen, maar dat gaat niet automatisch. Dus zodra je een nieuw wachtwoord hebt gekozen, krijgen wij een melding en kunnen wij op een wiskundig veilige manier de sleutel bij jou brengen zonder dat het computersysteem dit kan lezen. Allemaal erg ingewikkeld, maar op die manier worden de gegevens van onze leden zo veilig mogelijk opgeslagen.</p>
                </div>
                <div v-if="(!member.details.isRecovered || member.details.records.length > 0) && !shouldSkipRecords">
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
                            <div>
                                <button v-if="!member.details.isRecovered" class="button text limit-space" @click="editRecords()">
                                    <span class="icon edit" />
                                    <span>Bewerken</span>
                                </button>
                            </div>
                        </h2>

                        <ul class="member-records">
                            <li
                                v-for="(record, index) in sortedRecords"
                                :key="index"
                                v-tooltip="record.description.length > 0 ? record.description : null"
                                :class="{ [LegacyRecordTypeHelper.getPriority(record.type)]: true}"
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
            <button slot="right" class="secundary button" @click="fullCheck">
                <span v-if="member.details.isRecovered" class="icon edit" />
                <span v-else class="icon search" />
                <span v-if="member.details.isRecovered">Opnieuw invullen</span>
                <span v-else>Nakijken</span>
            </button>
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
import { LoginHelper, SessionManager } from "@stamhoofd/networking";
import { LegacyRecord,LegacyRecordTypePriority, MemberDetails, MemberWithRegistrations, Parent, LegacyRecordTypeHelper, Registration, User } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from "../../classes/MemberManager";
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

    LegacyRecordTypeHelper = LegacyRecordTypeHelper

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

    async fullCheck() {
        await this.openSteps([
            EditMemberStepType.Details,
            EditMemberStepType.Parents,
            EditMemberStepType.EmergencyContact,
            EditMemberStepType.Records,
        ], false, async (details: MemberDetails) => {
            // Do basic check if information is okay
            if (details.lastName && details.isRecovered) {
                details.isRecovered = false
            }
            
            return Promise.resolve()
        })
    }

    async openSteps(steps: EditMemberStepType[], force = true, lastSaveHandler?: (details: MemberDetails) => Promise<void>) {
        const stepManager = new EditMemberStepsManager(
            steps, 
            this.member,
            async (component: NavigationMixin) => {
                component.dismiss({ force: true })
                return Promise.resolve()
            }
        )
        stepManager.force = force
        stepManager.lastSaveHandler = lastSaveHandler
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

    imageSrc(registration: Registration) {
        const group = this.getGroup(registration.groupId)
        if (!group) {
            return null
        }
        return (group.settings.squarePhoto ?? group.settings.coverPhoto)?.getPathForSize(100, 100)
    }

    getIcon(record: LegacyRecord) {
        switch (LegacyRecordTypeHelper.getPriority(record.type)) {
            case LegacyRecordTypePriority.High: return " exclamation-two red"
            case LegacyRecordTypePriority.Medium: return " exclamation yellow"
            case LegacyRecordTypePriority.Low: return " info"
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
            const priority1: string = LegacyRecordTypeHelper.getPriority(record1.type);
            const priority2: string = LegacyRecordTypeHelper.getPriority(record2.type)

            if (priority1 == LegacyRecordTypePriority.High && priority2 == LegacyRecordTypePriority.Medium ||
                priority1 == LegacyRecordTypePriority.Medium && priority2 == LegacyRecordTypePriority.Low ||
                priority1 == LegacyRecordTypePriority.High && priority2 == LegacyRecordTypePriority.Low) {
                return -1;
            }
            else if (priority1 == LegacyRecordTypePriority.Low && priority2 == LegacyRecordTypePriority.Medium ||
                priority1 == LegacyRecordTypePriority.Medium && priority2 == LegacyRecordTypePriority.High ||
                priority1 == LegacyRecordTypePriority.Low && priority2 == LegacyRecordTypePriority.High) {
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
</style>
