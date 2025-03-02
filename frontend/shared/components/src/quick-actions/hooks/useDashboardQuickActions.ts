import { Decoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, PayableBalanceCollection, PermissionsResourceType } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, onActivated, onMounted, ref, Ref, unref } from 'vue';
import { useContextOptions } from '../../context';
import PlatformAvatar from '../../context/PlatformAvatar.vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { useErrors } from '../../errors/useErrors';
import { GlobalEventBus } from '../../EventBus';
import { useAuth, useContext, usePlatform } from '../../hooks';
import { mergeErrorBox, QuickAction, QuickActions } from '../classes/QuickActions';
import { useRegistrationQuickActions } from './useRegistrationQuickActions';

import outstandingAmountSvg from '@stamhoofd/assets/images/illustrations/outstanding-amount.svg';
import eventNotificationSvg from '@stamhoofd/assets/images/illustrations/event-notifications.svg';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useVisibilityChange } from '../../composables';
import { Toast } from '../../overlays/Toast';

export function useDashboardQuickActions(): QuickActions {
    const registrationQuickActions = useRegistrationQuickActions();
    const contextOptions = useContextOptions();
    const context = useContext();
    const owner = useRequestOwner();
    const errors = useErrors();
    const auth = useAuth();
    const $t = useTranslate();
    const platform = usePlatform();

    // Load outstanding amount
    const outstandingBalance = ref(null) as Ref<PayableBalanceCollection | null>;
    let lastLoadedBalance = new Date(0);

    // Fetch balance
    async function updateBalance() {
        if (!auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
            outstandingBalance.value = PayableBalanceCollection.create({});
            return;
        }

        if (lastLoadedBalance.getTime() > new Date().getTime() - 5 * 60 * 1000) {
            return;
        }
        lastLoadedBalance = new Date();

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

            for (const notificationType of platform.value.config.eventNotificationTypes) {
                if (!auth.permissions?.hasAccessRightForSomeResource(AccessRight.EventWrite)) {
                    continue;
                }
                const deadline = notificationType.deadlines.filter(d => d.deadline > new Date() && (d.reminderFrom === null || d.reminderFrom <= new Date())).sort((a, b) => Sorter.byDateValue(a.deadline, b.deadline))[0];
                if (deadline) {
                    arr.push({
                        illustration: eventNotificationSvg,
                        title: deadline.reminderTitle || notificationType.title,
                        description: deadline.reminderText ?? '',
                        action: async () => {
                            await GlobalEventBus.sendEvent('selectTabByName', 'activiteiten');
                            if (deadline.reminderText) {
                                new Toast(deadline.reminderText, 'info').setHide(20_000).show();
                            }
                        },
                    });
                }
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
