<template>
    <article class="container">
        <hr><h2 class="style-with-button">
            <button v-long-press="(e: any) => switchCycle(e)" type="button" class="button" @click.prevent="switchCycle" @contextmenu.prevent="switchCycle">
                {{ visibleRegistrationsTitle }}
                <span class="icon arrow-down-small" />
            </button>
            <div>
                <button v-if="hasWrite" v-long-press="(e: any) => addRegistration()" type="button" class="button icon add gray" @click.prevent="addRegistration" @contextmenu.prevent="addRegistration" />
            </div>
        </h2>

        <button v-if="!member.family.checkout.cart.isEmpty && app === 'registration'" class="info-box selectable icon" type="button" @click="openCart">
            <span>{{ $t('8b7dab90-8fea-4a23-8766-431ce27edaec') }}</span>
            <span class="button icon arrow-right-small" />
        </button>
        <template v-else>
            <p v-if="visibleRegistrations.length === 0 && period.id === defaultPeriod.id" class="info-box">
                {{ $t('74f14f24-6c35-4c61-a857-134408b0a2b4', {member: member.patchedMember.firstName}) }}
            </p>
            <p v-else-if="visibleRegistrations.length === 0" class="info-box">
                {{ $t('0985547b-d5fb-4ae7-9e09-1773e7918960', {member: member.patchedMember.firstName}) }}
            </p>
        </template>

        <STList v-if="hasWrite && app !== 'registration'">
            <ViewMemberRegistrationRow v-for="registration in visibleRegistrations" :key="registration.id" :member="member" :registration="registration" @edit="(e: any) => editRegistration(registration, e)" />
        </STList>
        <STList v-else>
            <ViewMemberRegistrationRow v-for="registration in visibleRegistrations" :key="registration.id" :member="member" :registration="registration" />
        </STList>

        <footer v-if="hasDeleted && !showDeleted" class="style-button-bar">
            <button class="button text" type="button" @click="showDeleted = true;">
                {{ $t('b0a3b188-34ec-4046-a6eb-24ddb2f816cf') }}
            </button>
        </footer>
    </article>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { useOrganizationManager, usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { LimitedFilteredRequest, PermissionLevel, PlatformMember, Registration, RegistrationPeriod } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { GlobalEventBus } from '../../../EventBus';
import { useMembersObjectFetcher } from '../../../fetchers/useMembersObjectFetcher';
import { useAuth, useOrganization, usePlatform } from '../../../hooks';
import { ContextMenu, ContextMenuItem } from '../../../overlays/ContextMenu';
import { Toast } from '../../../overlays/Toast';
import { TableActionSelection } from '../../../tables';
import TableActionsContextMenu from '../../../tables/TableActionsContextMenu.vue';
import { useChooseGroupForMember } from '../../checkout';
import { useRegistrationActionBuilder } from '../../classes/RegistrationActionBuilder';
import ViewMemberRegistrationRow from './ViewMemberRegistrationRow.vue';

const props = defineProps<{
    member: PlatformMember;
}>();

const visibleRegistrationsTitle = computed(() => {
    return period.value.name;
});

const auth = useAuth();
const present = usePresent();
const organization = useOrganization();
const organizationManager = useOrganizationManager();
const platform = usePlatform();

// If the organization of this member already moved to the next period, select it by default
const defaultPeriod = organization.value?.period?.period ?? props.member.filterOrganizations({ currentPeriod: true })[0]?.period?.period ?? props.member.filterOrganizations({})[0]?.period?.period ?? platform.value.period;
const period = ref(defaultPeriod) as Ref<RegistrationPeriod>;

const platformManager = usePlatformManager();
const owner = useRequestOwner();
const showDeleted = ref(false);
const app = useAppContext();
const hasDeleted = computed(() => {
    return filteredRegistrations.value.some(r => r.deactivatedAt);
});
const dismiss = useDismiss();

platformManager.value.loadPeriods(false, true, owner).catch(console.error);

const hasWrite = computed(() => {
    return !period.value.locked && auth.canAccessPlatformMember(props.member, PermissionLevel.Write);
});

const filteredRegistrations = computed(() => {
    return props.member.patchedMember.registrations.filter((r) => {
        if (!auth.hasSomePlatformAccess() && organization.value && r.organizationId !== organization.value.id && r.payingOrganizationId !== organization.value.id) {
            return false;
        }
        if (r.group.periodId !== period.value.id) {
            return false;
        }
        return true;
    }).sort((a, b) =>
        Sorter.stack(
            Sorter.byDateValue(a.deactivatedAt ?? new Date(2034522839 * 1000), b.deactivatedAt ?? new Date(2034522839 * 1000)),
            Sorter.byDateValue(b.registeredAt ?? b.createdAt, a.registeredAt ?? a.createdAt),

        ),
    );
});
const visibleRegistrations = computed(() => {
    if (!showDeleted.value) {
        return filteredRegistrations.value.filter(r => !r.deactivatedAt);
    }
    return filteredRegistrations.value;
});

const chooseGroupForMember = useChooseGroupForMember();

async function addRegistration() {
    await chooseGroupForMember({ member: props.member, displayOptions: { action: 'present', modalDisplayStyle: 'popup' } });
}

async function openCart() {
    await dismiss({ force: true });
    await GlobalEventBus.sendEvent('selectTabByName', 'mandje');
}

const buildActions = useRegistrationActionBuilder();
const objectFetcher = useMembersObjectFetcher();

async function editRegistration(registration: Registration, event: MouseEvent) {
    const builder = buildActions({
        registration,
        member: props.member,
    });

    const el = event.currentTarget! as HTMLElement;
    const bounds = el.getBoundingClientRect();

    const periods = await organizationManager.value.loadPeriods(false, true, owner).catch(console.error);
    const selectedOrganizationRegistrationPeriod = periods?.organizationPeriods.find(p => p.period.id === registration.group.periodId);
    const actions = builder.getActions({ selectedOrganizationRegistrationPeriod });

    if (actions.filter(a => a.enabled).length === 0) {
        Toast.warning($t(`1769b160-721b-41cc-98fa-869045abba79`)).show();
        return;
    }

    const selection: TableActionSelection<PlatformMember> = {
        filter: new LimitedFilteredRequest({
            filter: {
                id: props.member.id,
            },
            limit: 2,
        }),
        fetcher: objectFetcher, // todo
        markedRows: new Map([[props.member.id, props.member]]),
        markedRowsAreSelected: true,
    };

    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: bounds.right,
        y: bounds.bottom,
        xPlacement: 'left',
        yPlacement: 'bottom',
        actions,
        selection,
    });
    await present(displayedComponent.setDisplayStyle('overlay'));
}

function switchCycle(event: MouseEvent) {
    const menu = new ContextMenu([
        (platform.value.periods ?? []).slice(0, 5).map((p) => {
            return new ContextMenuItem({
                name: p.name,
                selected: p.id === period.value.id,
                action: () => {
                    period.value = p;
                    return true;
                },
            });
        }),
    ]);
    menu.show({ button: event.currentTarget as HTMLElement, yOffset: -10 }).catch(console.error);
}

</script>
