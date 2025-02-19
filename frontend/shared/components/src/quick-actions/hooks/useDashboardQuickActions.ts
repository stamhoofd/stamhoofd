import { Decoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, PayableBalanceCollection } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref, unref } from 'vue';
import { useContextOptions } from '../../context';
import PlatformAvatar from '../../context/PlatformAvatar.vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { useErrors } from '../../errors/useErrors';
import { GlobalEventBus } from '../../EventBus';
import { useAuth, useContext } from '../../hooks';
import { mergeErrorBox, QuickAction, QuickActions } from '../classes/QuickActions';
import { useRegistrationQuickActions } from './useRegistrationQuickActions';

import outstandingAmountSvg from '@stamhoofd/assets/images/illustrations/outstanding-amount.svg';
import { useTranslate } from '@stamhoofd/frontend-i18n';

export function useDashboardQuickActions(): QuickActions {
    const registrationQuickActions = useRegistrationQuickActions();
    const contextOptions = useContextOptions();
    const context = useContext();
    const owner = useRequestOwner();
    const errors = useErrors();
    const auth = useAuth();
    const $t = useTranslate();

    // Load outstanding amount
    const outstandingBalance = ref(null) as Ref<PayableBalanceCollection | null>;
    updateBalance().catch(console.error);

    // Fetch balance
    async function updateBalance() {
        if (!auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
            outstandingBalance.value = PayableBalanceCollection.create({});
            return;
        }

        try {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: `/organization/payable-balance`,
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

    return {
        actions: computed(() => {
            const arr: QuickAction[] = [];
            const registrationActions = unref(registrationQuickActions.actions);
            if (registrationActions.length > 0) {
                arr.push({
                    leftComponent: PlatformAvatar,
                    title: $t('5dac2674-d262-409c-a3f7-58b958c10876'),
                    description: registrationActions.length === 1
                        ? $t('6720c55c-b9a5-44ad-bdd5-4681e8e2478e')
                        : $t('d43da88d-8890-4fa8-894d-e0a4fa6d3565', { count: registrationActions.length.toString() }),
                    action: async () => {
                        contextOptions.selectOption(await contextOptions.getRegistrationOption());
                    },
                });
            }

            for (const organizationStatus of outstandingBalance.value?.organizations || []) {
                const open = organizationStatus.amountOpen;
                if (open <= 0) {
                    continue;
                }

                arr.push({
                    illustration: outstandingAmountSvg,
                    title: 'Betaal openstaand bedrag aan ' + organizationStatus.organization.name,
                    description: $t('Je moet nog {price} betalen aan {name}, via het tabblad Boekhouding.', {
                        price: Formatter.price(open),
                        name: organizationStatus.organization.name,
                    }),
                    action: async () => {
                        await GlobalEventBus.sendEvent('selectTabByName', 'boekhouding');
                    },
                });
            }

            return arr;
        }),
        loading: computed(() => {
            return unref(registrationQuickActions.loading) || (outstandingBalance.value === null);
        }),
        errorBox: computed(() => {
            return mergeErrorBox(
                unref(registrationQuickActions.errorBox),
                errors.errorBox,
            );
        }),
    };
}
