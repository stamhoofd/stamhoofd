import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, StartNewRegistrationPeriodView, Toast, useOrganization, usePlatform } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
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
                new CenteredMessage($t(`9128d20d-f23a-4d1e-a631-c61a25ade53c`), $t(`b34e7f10-2e03-42f5-b865-2d88571d2a6e`)).addCloseButton().show();
                return false;
            }

            // or if not starging within 8 months
            if (p.startDate.getTime() > new Date().getTime() + 1000 * 60 * 60 * 24 * 31 * 8) {
                new CenteredMessage($t(`9128d20d-f23a-4d1e-a631-c61a25ade53c`), $t('0ab4ec6b-ae79-4d48-bd45-37da8e712509')).addCloseButton().show();
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

        new Toast($t(`253b64ce-1507-4655-a75d-ae046e983329`) + ' ' + p.name, 'success').show();
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
