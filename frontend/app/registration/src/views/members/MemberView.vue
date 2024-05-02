<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.name" />
        
        <main class="member-view-details">
            <h1>
                <span>{{ member.name }}</span>
                <span v-if="member.activeRegistrations.length == 0" class="style-tag error">Nog niet ingeschreven</span>
            </h1>

            <hr>

            <div v-if="member.activeRegistrations.length > 0" class="container">
                <h2 class="style-with-button with-list">
                    <div>Ingeschreven voor</div>
                    <div>
                        <button class="button text limit-space" type="button" @click="chooseGroups()">
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
                                <span>{{ getGroup(registration.groupId).settings.getShortCode(2) }}</span>
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
                            Ingeschreven op {{ formatDateTime(registration.registeredAt) }}
                        </p>
                        <p v-else class="style-description-small">
                            Op wachtlijst sinds {{ formatDateTime(registration.createdAt) }}
                        </p>
                    </STListItem>
                </STList>
                <hr>
            </div>


            <div v-if="member.details.phone || member.details.email || member.details.address || member.details.birthDay || member.details.memberNumber" class="container">
                <h2 class="style-with-button">
                    <div>Algemeen</div>
                    <div>
                        <button class="button text limit-space" type="button" @click="editGeneral()">
                            <span class="icon edit" />
                            <span>Bewerken</span>
                        </button>
                    </div>
                </h2>
                <dl class="details-grid">
                    <template v-if="member.details.firstName">
                        <dt>Voornaam</dt>
                        <dd>
                            {{ member.details.firstName }}
                        </dd>
                    </template>

                    <template v-if="member.details.lastName">
                        <dt>Achternaam</dt>
                        <dd>
                            {{ member.details.lastName }}
                        </dd>
                    </template>

                    <template v-if="member.details.memberNumber">
                        <dt>Lidnummer</dt>
                        <dd>{{ member.details.memberNumber }}</dd>
                    </template>

                    <template v-if="member.details.birthDay">
                        <dt>Verjaardag</dt>
                        <dd>{{ member.details.birthDayFormatted }} ({{ member.details.age }} jaar)</dd>
                    </template>

                    <template v-if="member.details.phone">
                        <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
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
                        <button class="button text limit-space" type="button" @click.stop="editParents()">
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

            <div v-for="(contact, index) in member.details.emergencyContacts" :key="'contact-' + index" class="container">
                <h2 class="style-with-button">
                    <div>Noodcontact: {{ contact.title }}</div>
                    <div>
                        <button class="button text limit-space" type="button" @click.stop="editEmergencyContact(contact)">
                            <span class="icon edit" />
                            <span>Bewerken</span>
                        </button>
                    </div>
                </h2>

                <dl class="details-grid">
                    <dt>Naam</dt>
                    <dd>{{ contact.name }}</dd>

                    <dt>{{ $t('shared.inputs.mobile.label') }}</dt>
                    <dd>{{ contact.phone }}</dd>
                </dl>
                <hr>
            </div>

            <div v-if="false && member.details.doctor" class="container">
                <h2 class="style-with-button">
                    <div>Huisarts</div>
                    <div>
                        <button class="button text limit-space" type="button" @click="editRecords()">
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

            <!-- Loop all records -->
            <div v-for="category in recordCategories" :key="category.id" class="container">
                <h2 class="style-with-button">
                    <div>{{ category.name }}</div>
                    <div>
                        <button class="button text limit-space" type="button" @click="editRecordCategory(category)">
                            <span class="icon edit" />
                            <span>Bewerken</span>
                        </button>
                    </div>
                </h2>
                <RecordCategoryAnswersBox :category="category" :answers="member.details.recordAnswers" :data-permission="dataPermission" />
                <hr>
            </div>
        </main>

        <STToolbar>
            <template #right><button class="secundary button" type="button" @click="fullCheck">
                <span class="icon edit" />
                <span>Nakijken</span>
            </button>
            <button class="primary button" type="button" @click="chooseGroups">
                <span class="icon add" />
                <span>Inschrijven</span>
            </button></template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, RecordCategoryAnswersBox, STList, STListItem, STNavigationBar, STToolbar, TooltipDirective as Tooltip } from "@stamhoofd/components";
import { MemberDetails, MemberDetailsWithGroups, MemberWithRegistrations, RecordCategory, Registration } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import GroupTree from "../../components/GroupTree.vue";
import { BuiltInEditMemberStep, EditMemberStep, EditMemberStepsManager, EditMemberStepType, RecordCategoryStep } from "./details/EditMemberStepsManager";
import MemberChooseGroupsView from "./MemberChooseGroupsView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        GroupTree,
        RecordCategoryAnswersBox
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

    async editGeneral() {
        await this.openSteps(
            [
                new BuiltInEditMemberStep(this.$context, EditMemberStepType.Details, true, false), 
                new BuiltInEditMemberStep(this.$context, EditMemberStepType.Parents, true, false)
            ],
            false
        )
    }

    async editParents() {
        await this.openSteps([
            new BuiltInEditMemberStep(this.$context, EditMemberStepType.Parents, true, false)
        ])
    }

    async editEmergencyContact() {
        await this.openSteps([
            new BuiltInEditMemberStep(this.$context, EditMemberStepType.EmergencyContact, true, false)
        ])
    }

    async editRecordCategory(category: RecordCategory) {
        await this.openSteps([
            new RecordCategoryStep(this.$context, category, true, false)
        ])
    }

    get recordCategories(): RecordCategory[] {
        const definitions = MemberDetailsWithGroups.getFilterDefinitions(this.$organization, { member: this.member, registerItems: this.cartItems })

        return RecordCategory.filterCategories(
            this.$organization.meta.recordsConfiguration.recordCategories, 
            new MemberDetailsWithGroups(this.member.details, this.member, this.cartItems), 
            definitions,
            this.dataPermission
        ).flatMap(cat => {
            if (cat.childCategories.length > 0) {
                return cat.filterChildCategories(
                    new MemberDetailsWithGroups(this.member.details, this.member, this.cartItems), 
                    definitions,
                    this.dataPermission
                )
            }
            return [cat]
        })
    }

    get dataPermission() {
        return this.member.details.dataPermissions?.value ?? false
    }

    async fullCheck() {
        await this.openSteps(EditMemberStepsManager.getAllSteps(this.$context, true, false), false)
    }

    async openSteps(steps: EditMemberStep[], force = true, lastSaveHandler?: (details: MemberDetails) => Promise<void>) {
        const stepManager = new EditMemberStepsManager(
            this.$memberManager,
            steps, 
            this.cartItems,
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
        return this.$organization.groups.find(g => g.id === groupId)
    }

    chooseGroups() {
        this.show({
            components: [
                new ComponentWithProperties(MemberChooseGroupsView, {
                    member: this.member
                })
            ]
        })
    }

    get cartItems() {
        return this.$checkoutManager.cart.items.filter(i => i.member.id === this.member.id)
    }

    imageSrc(registration: Registration) {
        const group = this.getGroup(registration.groupId)
        if (!group) {
            return null
        }
        return (group.settings.squarePhoto ?? group.settings.coverPhoto)?.getPathForSize(100, 100)
    }
}
</script>