<template>
    <section class="st-view">
        <STNavigationBar title="Mijn account" />
        <main class="center">
            <h1>
                Mijn account
            </h1>

            <p>{{ $t('369440db-a9e0-4530-a06b-3ea05cc6a2b0') }}</p>

            <p v-if="members.length === 0" class="style-button-bar">
                <button v-if="isAcceptingNewMembers" class="button primary" type="button" @click="registerMembers">
                    <span class="icon edit" />
                    <span>Schrijf een lid in</span>
                </button>

                <a :href="$domains.getDocs('mijn-account')" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>Hulp nodig?</span>
                </a>
            </p>
            <p v-else class="style-button-bar">
                <a :href="$domains.getDocs('mijn-account')" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>Hulp nodig?</span>
                </a>
            </p>
            
            <QuickActionsBox :quick-actions="quickActions" />

            <div v-if="members.length > 0" class="container">
                <hr>
                <h2>
                    Leden
                </h2>

                <STList class="illustration-list">
                    <STListItem v-for="member of members" :key="member.id" class="right-stack" :selectable="true" @click="$navigate(Routes.ViewMember, {properties: {member}})">
                        <template #left>
                            <MemberIcon :member="member" :icon="getRegistrationsForMember(member).length === 0 ? 'canceled' : ''" />
                        </template>

                        <h3 class="style-title-list">
                            {{ member.patchedMember.name }}
                        </h3>
                        <p v-if="member.patchedMember.details.birthDayFormatted" class="style-description-small">
                            {{ member.patchedMember.details.birthDayFormatted }}
                        </p>

                        <p v-if="getRegistrationsForMember(member).length" class="style-description-small">
                            Ingeschreven voor {{ Formatter.joinLast(getRegistrationsForMember(member).map(r => r.group.settings.name), ', ', ' en ') }}.
                        </p>
                        <p v-else class="style-description-small">
                            {{ member.patchedMember.firstName }} is momenteel niet ingeschreven.
                        </p>


                        <template #right>
                            <span v-if="user && member.id === user.memberId" v-color="member" class="style-tag">Dit ben jij</span>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>
                </STList>

                <footer class="style-button-bar">
                    <button class="button text" type="button" @click="addNewMember">
                        <span class="icon add" />
                        <span>Nieuw gezinslid</span>
                    </button>
                </footer>
            </div>

            <div v-if="members.length > 0" class="container">
                <hr>
                <h2>
                    Acties
                </h2>

                <STList class="illustration-list">
                    <STListItem class="left-center" :selectable="true" @click="registerMembers">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            Lid inschrijven
                        </h3>
                        <p class="style-description-small">
                            Schrijf iemand in.
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>

                    <STListItem class="left-center" :selectable="true" @click="checkData">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/magnifier.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            Gegevens nakijken
                        </h3>
                        <p class="style-description-small">
                            Pas gegevens aan en bekijk al jouw inschrijvingen.
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>

                    <STListItem class="left-center" :selectable="true" @click="$navigate(Routes.Payments)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/creditcards.svg" class="style-illustration-img">
                        </template>

                        <h3 class="style-title-list">
                            Betalingen en openstaande rekening
                        </h3>
                        <p class="style-description-small">
                            Bekijk een overzicht van jouw recente betalingen en jouw openstaand bedrag.
                        </p>

                        <template #right>
                            <span class="icon gray arrow-right-small" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { MemberIcon, QuickActionsBox, Toast, useAddMember, useChooseGroupForMember, useRegistrationQuickActions, useUser } from '@stamhoofd/components';
import { GroupType, PlatformMember } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useMemberManager } from '@stamhoofd/networking';

enum Routes {
    RegisterMembers = 'registerMembers',
    CheckData = 'checkData',
    ViewMember = 'viewMember',
    Payments = 'payments'
}
defineRoutes([
    {
        name: Routes.RegisterMembers,
        url: 'registreren',
        component: async () => (await import('../members/RegisterMembersView.vue')).default as any,
        present: 'popup'
    },
    {
        name: Routes.CheckData,
        url: 'gegevens',
        component: async () => (await import('../members/CheckDataView.vue')).default as any,
        present: 'popup'
    },
    {
        name: Routes.Payments,
        url: 'betalingen',
        component: async () => (await import('./payments/MemberBillingStatusView.vue')).default as any,
        present: 'popup'
    },
    {
        name: Routes.ViewMember,
        url: 'leden/@id',
        component: async () => (await import('../members/MemberView.vue')).default as any,
        present: 'popup',
        params: {
            id: String
        },
        paramsToProps: async (params: {id: string}) => {
            const member = members.value.find(m => m.id === params.id)
            if (member) {
                return {
                    member
                }
            }
            Toast.error('Lid niet gevonden').show()
            throw new Error('member not found')
        },

        propsToParams(props) {
            if (!("member" in props) || typeof props.member !== 'object' || props.member === null || !("id" in props.member)) {
                throw new Error('Missing member')
            }
            return {
                params: {
                    id: props.member.id
                }
            }
        }
    }
])
const $navigate = useNavigate();
const memberManager = useMemberManager();
const user = useUser();
const quickActions = useRegistrationQuickActions()

const members = computed(() => memberManager.family.members);
const isAcceptingNewMembers = computed(() => memberManager.isAcceptingNewMembers);
const chooseGroupForMember = useChooseGroupForMember()
const addMember = useAddMember()

async function registerMembers() {
    await $navigate(Routes.RegisterMembers);
}

async function checkData() {
    await $navigate(Routes.CheckData);
}

function getRegistrationsForMember(member: PlatformMember) {
    return member.filterRegistrations({currentPeriod: true, types: [GroupType.Membership, GroupType.WaitingList]}).sort((a, b) => 
        Sorter.stack(
            Sorter.byDateValue(b.registeredAt ?? b.createdAt, a.registeredAt ?? a.createdAt)
        )
    );
}

async function addNewMember() {
    await addMember(memberManager.family, {
        displayOptions: {action: 'present', modalDisplayStyle: 'popup'},
        async finishHandler(member, navigate) {
            await chooseGroupForMember({
                member,
                displayOptions: {action: 'show', replace: 100, force: true},
                customNavigate: navigate
            })
        },
    });
}
</script>
