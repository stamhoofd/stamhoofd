<template>
    <div v-if="!checkout.cart.isEmpty || membersWithMissingData.length || membersWithMissingEmail.length" class="container">
        <hr>
        <h2>
            Snelle acties
        </h2>

        <STList>
            <STListItem v-if="!checkout.cart.isEmpty" class="left-center right-stack" :selectable="true" @click="openCart()">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/cart.svg" class="style-illustration-img">
                </template>
                <h3 class="style-title-list">
                    Mandje afrekenen
                </h3>
                <p v-if="cart.price" class="style-description-small">
                    Betaal en bevestig je inschrijvingen.
                </p>
                <p v-else class="style-description-small">
                    Bevestig je inschrijvingen.
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem v-for="{member, steps} of membersWithMissingData" :key="'missing-'+member.id" class="left-center" :selectable="true" @click="fillInMemberMissingData(member)">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/missing-data.svg" class="style-illustration-img">
                </template>
                <h3 class="style-title-list">
                    Vul ontbrekende gegevens aan van {{ member.patchedMember.details.firstName }}
                </h3>
                <p class="style-description-small">
                    Enkele gegevens van {{ member.patchedMember.details.firstName }} ontbreken ({{ steps }}). Vul ze hier aan.
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem v-for="member of membersWithMissingEmail" :key="'missing-email-'+member.id" class="left-center" :selectable="true" @click="checkAllMemberData(member)">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/email-warning.svg" class="style-illustration-img">
                </template>
                <h3 class="style-title-list">
                    Het e-mailadres van dit account is niet toegevoegd bij {{ member.patchedMember.details.firstName }}
                </h3>
                <p v-if="member.patchedMember.details.parents.length || member.patchedMember.details.parentsHaveAccess" class="style-description-small">
                    Voeg jouw e-mailadres ({{ user?.email }}) toe bij één van de ouders of bij {{ member.patchedMember.details.firstName }} als je {{ member.patchedMember.details.firstName }} zelf bent, anders verlies je in de toekomst automatisch de toegang tot dit lid. Je kan ook het e-mailadres van je account zelf wijzigen (rechts bovenaan) als je dit e-mailadres niet meer wilt gebruiken.
                </p>
                <p v-else class="style-description-small">
                    Voeg jouw e-mailadres ({{ user?.email }}) toe bij het e-mailadres van {{ member.patchedMember.details.firstName }}, anders verlies je in de toekomst automatisch de toegang tot dit lid. Je kan ook het e-mailadres van je account zelf wijzigen (rechts bovenaan) als je dit e-mailadres niet meer wilt gebruiken.
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { GlobalEventBus, useContext, useEditMember, useNavigationActions, useUser } from '@stamhoofd/components';
import { MemberStepManager } from '@stamhoofd/components/src/members/classes/MemberStepManager';
import { getAllMemberSteps } from '@stamhoofd/components/src/members/classes/steps';
import { GroupType, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useMemberManager } from '../../../getRootView';

const memberManager = useMemberManager();
const checkout = computed(() => memberManager.family.checkout)
const cart = computed(() => checkout.value.cart)
const context = useContext();
const navigate = useNavigationActions();
const user = useUser();
const editMember = useEditMember();

async function openCart() {
    await GlobalEventBus.sendEvent('selectTabByName', 'mandje')
}

async function fillInMemberMissingData(member: PlatformMember) {
    const steps = getAllMemberSteps(member, null, {outdatedTime: null});
    const manager = new MemberStepManager(context.value, member, steps, async (navigate) => {
        await navigate.dismiss({force: true})
    }, {action: 'present', modalDisplayStyle: 'popup'});

    await manager.saveHandler(null, navigate)
}

async function checkAllMemberData(member: PlatformMember) {
    await editMember(member, {title: 'Gegevens nakijken'})
}

const activeMembers = computed(() => memberManager.family.members.filter(m => m.filterRegistrations({currentPeriod: true, types: [GroupType.Membership]}).length > 0))

const membersWithMissingData = computed(() => activeMembers.value.flatMap(member => {
    const steps = getAllMemberSteps(member, null, {outdatedTime: null});
    const manager = new MemberStepManager(context.value, member, steps, () => {});
    const activeSteps = steps.filter(s => s.isEnabled(manager))

    if (activeSteps.length > 0) {
        return [
            {
                member,
                steps: Formatter.joinLast(activeSteps.map(s => s.getName(manager)), ', ', ' en ')
            }
        ];
    }

    return [];
}))

const membersWithMissingEmail = computed(() => {
    return activeMembers.value.filter(member => {
        return !member.patchedMember.details.hasEmail(user.value?.email ?? '');
    })
});
</script>
