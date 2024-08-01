<template>
    <div class="container">
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

        <p v-if="visibleRegistrations.length == 0 && period.id === defaultPeriod.id" class="info-box">
            {{ member.patchedMember.firstName }} is niet ingeschreven
        </p>
        <p v-else-if="visibleRegistrations.length == 0" class="info-box">
            {{ member.patchedMember.firstName }} was niet ingeschreven
        </p>

        <STList v-if="hasWrite">
            <MemberRegistrationRow v-for="registration in visibleRegistrations" :key="registration.id" :member="member" :registration="registration" @edit="(e) => editRegistration(registration, e)" />
        </STList>
        <STList v-else>
            <MemberRegistrationRow v-for="registration in visibleRegistrations" :key="registration.id" :member="member" :registration="registration" />
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { PermissionLevel, PlatformMember, Registration, RegistrationPeriod } from '@stamhoofd/structures';
import { Ref, computed, ref } from 'vue';
import { useAuth, useContext, useOrganization, usePlatform } from '../../hooks';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import TableActionsContextMenu from '../../tables/TableActionsContextMenu.vue';
import { usePlatformFamilyManager } from '../PlatformFamilyManager';
import ChooseGroupForMemberView from '../ChooseGroupForMemberView.vue';
import { MemberActionBuilder } from '../classes/MemberActionBuilder';
import MemberRegistrationRow from './MemberRegistrationRow.vue';

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
const platformFamilyManager = usePlatformFamilyManager()

platformManager.value.loadPeriods(false, true, owner).catch(console.error);

const hasWrite = auth.canAccessPlatformMember(props.member, PermissionLevel.Write);
const context = useContext();
const visibleRegistrations = computed(() => {
    return props.member.patchedMember.registrations.filter(r => {
        if (organization.value && r.organizationId !== organization.value.id) {
            return false;
        }
        if (r.group.periodId !== period.value.id) {
            return false;
        }
        return true
    });
});


async function addRegistration() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ChooseGroupForMemberView, {
                    member: props.member
                })
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function editRegistration(registration: Registration, event: MouseEvent) {
    const builder = new MemberActionBuilder({
        present,
        groups: [registration.group],
        organizations: props.member.organizations.filter(o => o.id === registration.group.organizationId),
        context: context.value,
        platformFamilyManager
    })

    const actions = [
        ...builder.getUnsubscribeAction().map(a => a.setGroupIndex(0).setPriority(10)),
        ...builder.getMoveAction().map(a => a.setGroupIndex(1).setPriority(5)),
        ...builder.getWaitingListActions()
    ]

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
