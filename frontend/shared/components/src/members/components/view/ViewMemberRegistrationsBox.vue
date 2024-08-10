<template>
    <article class="container">
        <hr>
        <h2 class="style-with-button">
            <button v-long-press="(e) => switchCycle(e)" type="button" class="button" @click.prevent="switchCycle" @contextmenu.prevent="switchCycle">
                {{ visibleRegistrationsTitle }}
                <span class="icon arrow-down-small" />
            </button>
            <div>
                <button v-if="hasWrite" v-long-press="(e) => addRegistration(e)" type="button" class="button icon add gray" @click.prevent="addRegistration" @contextmenu.prevent="addRegistration" />
            </div>
        </h2>

        <button v-if="!member.family.checkout.cart.isEmpty" class="info-box selectable icon" type="button" @click="openCart">
            <span>Er staan inschrijvingen klaar in je mandje. Reken ze af om ze definitief te maken.</span>
            <span class="button icon arrow-right-small" />
        </button>
        <template v-else>
            <p v-if="visibleRegistrations.length == 0 && period.id === defaultPeriod.id" class="info-box">
                {{ member.patchedMember.firstName }} is niet ingeschreven
            </p>
            <p v-else-if="visibleRegistrations.length == 0" class="info-box">
                {{ member.patchedMember.firstName }} was niet ingeschreven
            </p>
        </template>

        <STList v-if="hasWrite && app !== 'registration'">
            <ViewMemberRegistrationRow v-for="registration in visibleRegistrations" :key="registration.id" :member="member" :registration="registration" @edit="(e) => editRegistration(registration, e)" />
        </STList>
        <STList v-else>
            <ViewMemberRegistrationRow v-for="registration in visibleRegistrations" :key="registration.id" :member="member" :registration="registration" />
        </STList>

        <footer v-if="hasDeleted && !showDeleted" class="style-button-bar">
            <button class="button text" type="button" @click="showDeleted = true;">
                Toon beëindigde inschrijvingen
            </button>
        </footer>   
    </article>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { PermissionLevel, PlatformMember, Registration, RegistrationPeriod } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Ref, computed, ref } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { GlobalEventBus } from '../../../EventBus';
import { useAuth, useOrganization, usePlatform } from '../../../hooks';
import { ContextMenu, ContextMenuItem } from '../../../overlays/ContextMenu';
import { Toast } from '../../../overlays/Toast';
import TableActionsContextMenu from '../../../tables/TableActionsContextMenu.vue';
import { useChooseGroupForMember } from '../../checkout';
import { useRegistrationActionBuilder } from '../../classes/RegistrationActionBuilder';
import ViewMemberRegistrationRow from './ViewMemberRegistrationRow.vue';

const props = defineProps<{
    member: PlatformMember
}>();

const visibleRegistrationsTitle = computed(() => {
    return period.value.name
});

const auth = useAuth();
const present = usePresent();
const organization = useOrganization();
const platform = usePlatform();
const defaultPeriod = organization.value?.period?.period ?? platform.value.period
const period = ref(defaultPeriod) as Ref<RegistrationPeriod>;
const platformManager = usePlatformManager();
const owner = useRequestOwner();
const showDeleted = ref(false);
const app = useAppContext()
const hasDeleted = computed(() => {
    return filteredRegistrations.value.some(r => r.deactivatedAt);
});
const dismiss = useDismiss();

platformManager.value.loadPeriods(false, true, owner).catch(console.error);

const hasWrite = auth.canAccessPlatformMember(props.member, PermissionLevel.Write);

const filteredRegistrations = computed(() => {
    return props.member.patchedMember.registrations.filter(r => {
        if (organization.value && r.organizationId !== organization.value.id) {
            return false;
        }
        if (r.group.periodId !== period.value.id) {
            return false;
        }
        return true
    }).sort((a, b) => 
        Sorter.stack(
            Sorter.byDateValue(b.deactivatedAt ?? new Date(0), a.deactivatedAt ?? new Date(0)),
            Sorter.byDateValue(b.registeredAt ?? b.createdAt, a.registeredAt ?? a.createdAt)

        )
    );
});
const visibleRegistrations = computed(() => {
    if (!showDeleted.value) {
        return filteredRegistrations.value.filter(r => !r.deactivatedAt);
    }
    return filteredRegistrations.value;
});

const chooseGroupForMember = useChooseGroupForMember()

async function addRegistration() {
    await chooseGroupForMember({member: props.member, displayOptions: {action: 'present', modalDisplayStyle: 'popup'}})
}

async function openCart() {
    await dismiss({force: true})
    await GlobalEventBus.sendEvent('selectTabByName', 'mandje')
}

const buildActions = useRegistrationActionBuilder()

async function editRegistration(registration: Registration, event: MouseEvent) {
    const builder = buildActions({
        registration,
        member: props.member
    })

    const actions = builder.getActions()

    if (actions.filter(a => a.enabled).length === 0) {
        Toast.warning('Er zijn geen acties beschikbaar voor deze inschrijving').show()
        return;
    }

    const el = event.currentTarget! as HTMLElement;
    const bounds = el.getBoundingClientRect()

    const displayedComponent = new ComponentWithProperties(TableActionsContextMenu, {
        x: bounds.right,
        y: bounds.bottom,
        xPlacement: "left",
        yPlacement: "bottom",
        actions,
        selection: {
            isSingle: true,
            hasSelection: true,
            getSelection: () => {
                return [props.member]
            }
        }
    });
    await present(displayedComponent.setDisplayStyle("overlay"));
}

function switchCycle(event: MouseEvent) {
    const menu = new ContextMenu([
        (platform.value.periods ?? []).map(p => {
            return new ContextMenuItem({
                name: p.name,
                selected: p.id === period.value.id,
                action: () => {
                    period.value = p
                    return true;
                }
            });
        })
    ])
    menu.show({ button: event.currentTarget as HTMLElement, yOffset: -10 }).catch(console.error)
}

</script>
