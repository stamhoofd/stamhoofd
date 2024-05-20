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

        <p v-if="visibleRegistrations.length == 0 && cycleOffset == 0" class="info-box">
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
import { PermissionLevel, PlatformMember, Registration } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useAuth, useOrganization } from '../../hooks';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import RegisterMemberView from '../RegisterMemberView.vue';
import MemberRegistrationRow from './MemberRegistrationRow.vue';

const props = defineProps<{
    member: PlatformMember
}>();

const visibleRegistrationsTitle = computed(() => {
    if (cycleOffset.value === 0) {
        return 'Inschrijvingen';
    }
    if (cycleOffset.value === 1) {
        return 'Vorige inschrijvingsperiode';
    }

    return 'Inschrijvingen '+cycleOffset.value+' periodes geleden';
});

const cycleOffset = ref(0);
const auth = useAuth();
const present = usePresent();
const organization = useOrganization();

const hasWrite = auth.canAccessPlatformMember(props.member, PermissionLevel.Write);
const visibleRegistrations = computed(() => {
    return props.member.patchedMember.registrations.filter(r => {
        if (organization.value && r.organizationId !== organization.value.id) {
            return false;
        }
        const group = props.member.allGroups.find(g => g.id === r.groupId);
        if (!group) {
            return false;
        }
        return group.cycle === r.cycle + cycleOffset.value;
    });
});


async function addRegistration() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(RegisterMemberView, {
                    member: props.member
                })
            })
        ],
        modalDisplayStyle: "popup"
    })
}

function editRegistration(registration: Registration, event: MouseEvent) {
    //todo
}

function switchCycle(event: MouseEvent) {
    let maxCycle = 1;
    for (const registration of props.member.patchedMember.registrations) {
        const group = props.member.allGroups.find(g => g.id === registration.groupId)
        if (group) {
            const offset = group.cycle - registration.cycle;
            if (offset > maxCycle) {
                maxCycle = offset;
            }
        }
    }

    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: "Huidige inschrijvingsperiode",
                selected: cycleOffset.value === 0,
                action: () => {
                    cycleOffset.value = 0;
                    return true;
                }
            }),
            // Repeat maxCycle times
            ...Array.from({ length: maxCycle }, (_, i) => i + 1).map(i => new ContextMenuItem({
                name: `${i === 1 ? 'Vorige' : i} inschrijvingsperiode${i >= 2 ? 's geleden' : ''}`,
                selected: cycleOffset.value === i,
                action: () => {
                    cycleOffset.value = i;
                    return true;
                }
            }))
        ],
    ])
    menu.show({ button: event.currentTarget as HTMLElement, yOffset: -10 }).catch(console.error)
}

</script>
