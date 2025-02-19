import { Decoder } from '@simonbackx/simple-encoding';
import { useMemberManager, useRequestOwner } from '@stamhoofd/networking';
import { GroupType, PayableBalanceCollection, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onActivated, onMounted, ref, Ref } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { useErrors } from '../../errors/useErrors';
import { GlobalEventBus } from '../../EventBus';
import { useContext, useUser } from '../../hooks';
import { useEditMember } from '../../members';
import { MemberStepManager } from '../../members/classes/MemberStepManager';
import { getAllMemberSteps } from '../../members/classes/steps';
import { useNavigationActions } from '../../types/NavigationActions';
import { QuickAction, QuickActions } from '../classes/QuickActions';

import cartSvg from '@stamhoofd/assets/images/illustrations/cart.svg';
import emailWarningSvg from '@stamhoofd/assets/images/illustrations/email-warning.svg';
import missingDataSvg from '@stamhoofd/assets/images/illustrations/missing-data.svg';
import outstandingAmountSvg from '@stamhoofd/assets/images/illustrations/outstanding-amount.svg';
import { useNavigate } from '@simonbackx/vue-app-navigation';
import { useVisibilityChange } from '../../composables';

export function useRegistrationQuickActions(): QuickActions {
    const memberManager = useMemberManager();
    const checkout = computed(() => memberManager.family.checkout);
    const context = useContext();
    const navigate = useNavigationActions();
    const user = useUser();
    const editMember = useEditMember();
    const owner = useRequestOwner();
    const errors = useErrors();
    const $navigate = useNavigate();

    async function openCart() {
        await GlobalEventBus.sendEvent('selectTabByName', 'mandje');
    }

    async function fillInMemberMissingData(member: PlatformMember) {
        const steps = getAllMemberSteps(member, null, { outdatedTime: null });
        const manager = new MemberStepManager(context.value, member, steps, async (navigate) => {
            await navigate.dismiss({ force: true });
        }, { action: 'present', modalDisplayStyle: 'popup' });

        await manager.saveHandler(null, navigate);
    }

    async function checkAllMemberData(member: PlatformMember) {
        await editMember(member, { title: 'Gegevens nakijken' });
    }

    const activeMembers = computed(() => memberManager.family.members.filter(m => m.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership] }).length > 0));

    const membersWithMissingData = computed(() => activeMembers.value.flatMap((member) => {
        const steps = getAllMemberSteps(member, null, { outdatedTime: null });
        const manager = new MemberStepManager(context.value, member, steps, () => {});
        const activeSteps = steps.filter(s => s.isEnabled(manager));

        if (activeSteps.length > 0) {
            return [
                {
                    member,
                    steps: Formatter.joinLast(activeSteps.map(s => s.getName(manager)), ', ', ' en '),
                },
            ];
        }

        return [];
    }));

    const membersWithoutMissingData = computed(() => activeMembers.value.filter((member) => {
        return !membersWithMissingData.value.find(m => m.member.id === member.id);
    }));

    const membersWithMissingEmail = computed(() => {
        return membersWithoutMissingData.value.filter((member) => {
            return !member.patchedMember.details.hasEmail(user.value?.email ?? '');
        });
    });

    // Load outstanding amount
    console.log('Load outstanding balance setup');
    const outstandingBalance = ref(null) as Ref<PayableBalanceCollection | null>;
    let lastLoadedBalance = new Date(0)

    // Fetch balance
    async function updateBalance() {
        if (lastLoadedBalance.getTime() > new Date().getTime() - 5 * 60 * 1000) {
            return;
        }
        lastLoadedBalance = new Date();
        try {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: `/user/payable-balance`,
                decoder: PayableBalanceCollection as Decoder<PayableBalanceCollection>,
                shouldRetry: true,
                owner,
                timeout: 5 * 60 * 1000,
            });

            outstandingBalance.value = response.data;
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
        }
    }

    onMounted(() => {
        updateBalance().catch(console.error);
    });

    onActivated(() => {
        updateBalance().catch(console.error);
    });

    useVisibilityChange(() => {
        updateBalance().catch(console.error);
    });

    return {
        actions: computed(() => {
            const arr: QuickAction[] = [];
            if (!checkout.value.cart.isEmpty) {
                arr.push({
                    illustration: cartSvg,
                    title: 'Mandje afrekenen',
                    description: checkout.value.cart.price > 0 ? 'Betaal en bevestig je inschrijvingen.' : 'Bevestig je inschrijvingen.',
                    action: openCart,
                });
            }

            for (const organizationStatus of outstandingBalance.value?.organizations || []) {
                const open = organizationStatus.amountOpen;
                if (open <= 0) {
                    continue;
                }

                arr.push({
                    illustration: outstandingAmountSvg,
                    title: 'Betaal jouw openstaand bedrag aan ' + organizationStatus.organization.name,
                    description: 'Je hebt een openstaand bedrag van ' + Formatter.price(open) + ' bij ' + organizationStatus.organization.name + '',
                    rightText: Formatter.price(open),
                    rightTextClass: 'style-price',
                    action: async () => {
                        await $navigate('payments');
                    },
                });
            }

            for (const member of membersWithMissingData.value) {
                arr.push({
                    illustration: missingDataSvg,
                    title: `Vul ontbrekende gegevens aan van ${member.member.patchedMember.firstName}`,
                    description: `Enkele gegevens van ${member.member.patchedMember.firstName} ontbreken. Vul deze aan.`,
                    action: () => fillInMemberMissingData(member.member),
                });
            }

            for (const member of membersWithMissingEmail.value) {
                // Het e-mailadres van dit account is niet toegevoegd bij
                arr.push({
                    illustration: emailWarningSvg,
                    title: `Voeg e-mailadres toe van ${member.patchedMember.firstName}`,
                    description: `Voeg het e-mailadres waarmee je inlogt (${user.value?.email}) toe bij ${member.patchedMember.details.firstName}, anders wordt jouw account losgekoppeld van dit lid. Of wijzig het e-mailadres waarmee je inlogt.`,
                    action: () => checkAllMemberData(member),
                });
            }

            return arr;
        }),
        loading: computed(() => {
            return (outstandingBalance.value === null);
        }),
        errorBox: computed(() => {
            return errors.errorBox;
        }),
    };
}
