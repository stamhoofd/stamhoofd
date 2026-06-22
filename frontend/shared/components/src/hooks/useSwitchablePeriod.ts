import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';

import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods';
import type { OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { ref } from 'vue';

export function useSwitchablePeriod(options?: { onSwitch?: () => void | Promise<void> }) {
    const $organization = useOrganization();
    const period = ref($organization.value?.period as any) as Ref<OrganizationRegistrationPeriod>;
    const platform = usePlatform();
    const fetchOrganizationRegistrationPeriods = useFetchOrganizationRegistrationPeriods();

    async function openPeriod(p: RegistrationPeriod) {
        const list = await fetchOrganizationRegistrationPeriods({
            shouldRetry: false,
            force: false,
        });
        const organizationPeriod = list.organizationPeriods.find(o => o.period.id === p.id);
        if (!organizationPeriod) {
            new CenteredMessage($t(`%10G`), $t(`%1XQ`)).addCloseButton().show();
            return false;
        }

        period.value = organizationPeriod;

        if (options?.onSwitch) {
            await options.onSwitch();
        }
        return true;
    }

    async function switchPeriod(event: MouseEvent, periodFilter: (period: RegistrationPeriod) => boolean = () => true) {
        const button = event.currentTarget as HTMLElement;

        // Load groups
        const list = await fetchOrganizationRegistrationPeriods({
            shouldRetry: false,
            force: false,
        });

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
