import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu.ts';
import StartNewRegistrationPeriodView from '@stamhoofd/components/periods/StartNewRegistrationPeriodView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
import { Ref, ref } from 'vue';

export function useSwitchablePeriod(options?: { onSwitch?: () => void | Promise<void> }) {
    const $organization = useOrganization();
    const period = ref($organization.value?.period as any) as Ref<OrganizationRegistrationPeriod>;
    const organizationManager = useOrganizationManager();
    const owner = useRequestOwner();
    const platform = usePlatform();
    const present = usePresent();

    async function openPeriod(p: RegistrationPeriod) {
        const list = await organizationManager.value.loadPeriods(false, false, owner);
        const organization = $organization.value!;

        const organizationPeriod = list.organizationPeriods.find(o => o.period.id === p.id);
        if (!organizationPeriod) {
            // Can not start if ended
            if (
                (STAMHOOFD.environment !== 'development' && (p.endDate < new Date() || p.startDate < organization.period.period.startDate))
                || p.locked
            ) {
                new CenteredMessage($t(`%10G`), $t(`%WO`)).addCloseButton().show();
                return false;
            }

            // or if not starging within 8 months
            if (p.startDate.getTime() > new Date().getTime() + 1000 * 60 * 60 * 24 * 31 * 8) {
                new CenteredMessage($t(`%10G`), $t('%17v')).addCloseButton().show();
                return false;
            }

            await present({
                components: [
                    new ComponentWithProperties(StartNewRegistrationPeriodView, {
                        period: p,
                        callback: async () => {
                            const newList = await organizationManager.value.loadPeriods(false, false, owner);
                            const organizationPeriod = newList.organizationPeriods.find(o => o.period.id === p.id);

                            if (organizationPeriod) {
                                period.value = organizationPeriod;
                            }

                            if (options?.onSwitch) {
                                await options.onSwitch();
                            }
                        },
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
            return true;
        }

        new Toast($t(`%WP`) + ' ' + p.name, 'success').show();
        period.value = organizationPeriod;

        if (options?.onSwitch) {
            await options.onSwitch();
        }
        return true;
    }

    async function switchPeriod(event: MouseEvent, periodFilter: (period: RegistrationPeriod) => boolean = () => true) {
        const button = event.currentTarget as HTMLElement;

        // Load groups
        const list = await organizationManager.value.loadPeriods(false, false, owner);

        const menu = new ContextMenu([
            (list.periods.slice(0, 10) ?? []).map((p) => {
                return new ContextMenuItem({
                    name: p.name,
                    selected: p.id === period.value.period.id,
                    icon: p.id === platform.value.period.id && p.id !== period.value.period.id ? 'dot' : '',
                    disabled: !periodFilter(p),
                    action: async () => {
                        await openPeriod(p);
                        return true;
                    },
                });
            }),
        ]);
        menu.show({ button, yOffset: -10 }).catch(console.error);
    }

    return {
        period,
        openPeriod,
        switchPeriod,
    };
}
