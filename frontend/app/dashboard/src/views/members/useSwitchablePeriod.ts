import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, Toast, useOrganization, usePlatform } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Ref, ref } from 'vue';
import StartNewRegistrationPeriodView from './StartNewRegistrationPeriodView.vue';

export function useSwitchablePeriod(options?: { onSwitch?: () => void | Promise<void> }) {
    const $organization = useOrganization();
    const period = ref($organization.value?.period as any) as Ref<OrganizationRegistrationPeriod>;
    const organizationManager = useOrganizationManager();
    const owner = useRequestOwner();
    const platform = usePlatform();
    const present = usePresent();

    async function switchPeriod(event: MouseEvent) {
        const button = event.currentTarget as HTMLElement;

        // Load groups
        const list = await organizationManager.value.loadPeriods(false, false, owner);
        const organization = $organization.value!;

        const menu = new ContextMenu([
            (list.periods.slice(0, 10) ?? []).map((p) => {
                return new ContextMenuItem({
                    name: p.name,
                    selected: p.id === period.value.period.id,
                    icon: p.id === platform.value.period.id && p.id !== period.value.period.id ? 'dot' : '',
                    action: async () => {
                        const organizationPeriod = list.organizationPeriods.find(o => o.period.id === p.id);
                        if (!organizationPeriod) {
                            // Can not start if ended, or if not starging withing 2 months
                            if (p.endDate < new Date() || p.startDate < organization.period.period.startDate) {
                                new CenteredMessage('Niet beschikbaar', 'Deze periode is niet beschikbaar voor jouw organisatie.').addCloseButton().show();
                                return false;
                            }

                            if (p.startDate.getTime() > new Date().getTime() + 1000 * 60 * 60 * 24 * 62 && STAMHOOFD.environment !== 'development') {
                                new CenteredMessage('Niet beschikbaar', 'Je kan pas 2 maand voor de start van het nieuwe werkjaar overschakelen.').addCloseButton().show();
                                return false;
                            }

                            await present({
                                components: [
                                    new ComponentWithProperties(StartNewRegistrationPeriodView, {
                                        period: p,
                                        callback: async () => {
                                            period.value = organizationManager.value.organization.period;

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

                        new Toast('Je bekijkt nu ' + p.name, 'success').show();
                        period.value = organizationPeriod;

                        if (options?.onSwitch) {
                            await options.onSwitch();
                        }
                        return true;
                    },
                });
            }),
        ]);
        menu.show({ button, yOffset: -10 }).catch(console.error);
    }

    return {
        period,
        switchPeriod,
    };
}
