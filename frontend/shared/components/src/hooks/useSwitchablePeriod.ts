import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';

import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods';
import { useFetchRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchRegistrationPeriods';
import type { OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { ref } from 'vue';

type Options = { onSwitch?: () => void | Promise<void> };

export function useSwitchablePeriod(options?: Options) {
    const $organization = useOrganization();
    const platform = usePlatform();
    const fetchOrganizationRegistrationPeriods = useFetchOrganizationRegistrationPeriods();
    const fetchRegistrationPeriods = useFetchRegistrationPeriods();

    const period = ref(($organization.value?.period.period ?? platform.value.period) as any) as Ref<RegistrationPeriod>;
    const organizationPeriod = ref($organization.value?.period as any) as Ref<OrganizationRegistrationPeriod | null>;

    async function openPeriod(p: RegistrationPeriod) {
        if ($organization.value) {
            const list = await fetchOrganizationRegistrationPeriods({
                shouldRetry: false,
                force: false,
            });
            const found = list.organizationPeriods.find(o => o.period.id === p.id);
            if (!found) {
                new CenteredMessage($t(`%10G`), $t(`%1XQ`)).addCloseButton().show();
                return false;
            }

            organizationPeriod.value = found;
            period.value = found.period;
        } else {
            period.value = p;
        }

        if (options?.onSwitch) {
            await options.onSwitch();
        }
        return true;
    }

    async function switchPeriod(event: MouseEvent, periodFilter: (period: RegistrationPeriod) => boolean = () => true) {
        const button = event.currentTarget as HTMLElement;

        // Load periods
        const periods = $organization.value
            ? (await fetchOrganizationRegistrationPeriods({ shouldRetry: false, force: false })).periods
            : await fetchRegistrationPeriods({ shouldRetry: false });

        const menu = new ContextMenu([
            (periods.slice(0, 10) ?? []).map((p) => {
                return new ContextMenuItem({
                    name: p.name,
                    selected: p.id === period.value.id,
                    icon: p.id === platform.value.period.id && p.id !== period.value.id ? 'dot' : '',
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
        organizationPeriod,
        openPeriod,
        switchPeriod,
    };
}

/**
 * Only usable inside an organization scope, where every period has an OrganizationRegistrationPeriod.
 */
export function useSwitchableOrganizationPeriod(options?: Options) {
    const { organizationPeriod, openPeriod, switchPeriod } = useSwitchablePeriod(options);

    return {
        period: organizationPeriod as Ref<OrganizationRegistrationPeriod>,
        openPeriod,
        switchPeriod,
    };
}
