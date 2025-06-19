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

import { useNavigate } from '@simonbackx/vue-app-navigation';
import cartSvg from '@stamhoofd/assets/images/illustrations/cart.svg';
import emailWarningSvg from '@stamhoofd/assets/images/illustrations/email-warning.svg';
import missingDataSvg from '@stamhoofd/assets/images/illustrations/missing-data.svg';
import outstandingAmountSvg from '@stamhoofd/assets/images/illustrations/outstanding-amount.svg';
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
        await GlobalEventBus.sendEvent('selectTabById', 'cart');
    }

    async function fillInMemberMissingData(member: PlatformMember) {
        const steps = getAllMemberSteps(member, null, { outdatedTime: null });
        const manager = new MemberStepManager(context.value, member, steps, async (navigate) => {
            await navigate.dismiss({ force: true });
        }, { action: 'present', modalDisplayStyle: 'popup' });

        await manager.saveHandler(null, navigate);
    }

    async function checkAllMemberData(member: PlatformMember) {
        await editMember(member, { title: $t(`d14e4e63-c77d-44d9-b8d0-adf05e299303`) });
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
    let lastLoadedBalance = new Date(0);

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
                    title: $t(`ecdcc78a-f91f-42e5-92f9-636225616c4c`),
                    description: checkout.value.cart.price > 0 ? $t(`ddff3e4b-56df-4279-8e91-b61011dfdb01`) : $t(`d73a6677-2a0d-456a-9c1a-85dccfc2c452`),
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
                    title: $t(`868011d2-7d0b-4739-955a-236d9cb6a39a`) + ' ' + organizationStatus.organization.name,
                    description: $t(`6d5ed993-d9a6-4573-b838-adf3beaf17a5`) + ' ' + Formatter.price(open) + ' ' + $t(`4d72ebf2-dd5a-49cf-b5a0-dac956b6f2de`) + ' ' + organizationStatus.organization.name + '',
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
                    title: $t(`b9bac60d-1fd8-43e7-9c9d-4b9b5227f9d6`, { member: member.member.patchedMember.firstName }),
                    description: $t(`77e44908-5498-4b91-9b4f-8e55cb282dc5`, { member: member.member.patchedMember.firstName }),
                    action: () => fillInMemberMissingData(member.member),
                });
            }

            for (const member of membersWithMissingEmail.value) {
                // Het e-mailadres van dit account is niet toegevoegd bij
                arr.push({
                    illustration: emailWarningSvg,
                    title: $t(`69385e1a-413f-4583-9061-67072d0742b9`, { member: member.patchedMember.firstName }),
                    description: $t(`9526c69d-cdbf-4c90-ae2b-a7a274e42c3c`, {
                        email: user.value?.email ?? '',
                        member: member.patchedMember.details.firstName,
                    }),
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
