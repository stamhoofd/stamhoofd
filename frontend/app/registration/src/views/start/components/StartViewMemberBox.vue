<template>
    <div class="container">
        <hr>
        <h2>{{ member.patchedMember.name }}</h2>

        <p class="info-box" v-if="filteredRegistrations.length === 0">
            {{ member.patchedMember.firstName }} is momenteel niet ingeschreven.
        </p>
        <p class="style-description-block" v-else>
            {{ member.patchedMember.firstName }} is ingeschreven voor {{ Formatter.joinLast(filteredRegistrations.map(r => r.group.settings.name), ', ', ' en ') }}.
        </p>

        <STList>
            <STListItem class="left-center" :selectable="true">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/magnifier.svg" class="style-illustration-img">
                </template>

                <h3 class="style-title-list">
                    Gegevens nakijken
                </h3>
                <p class="style-description-small">
                    Pas gegevens aan
                </p>

                <template #right>
                    <span class="icon gray arrow-right-small" />
                </template>
            </STListItem>

            <MemberRegistrationRow v-for="registration in filteredRegistrations" :key="registration.id" :member="member" :registration="registration" />
        </STList>
    </div>
</template>

<script setup lang="ts">
import { MemberRegistrationRow } from "@stamhoofd/components";
import { GroupType, PlatformMember } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = defineProps<{
    member: PlatformMember
}>();

const filteredRegistrations = computed(() => {
    return props.member.filterRegistrations({currentPeriod: true, types: [GroupType.Membership, GroupType.WaitingList]}).sort((a, b) => 
        Sorter.stack(
            Sorter.byDateValue(b.registeredAt ?? b.createdAt, a.registeredAt ?? a.createdAt)
        )
    );
});
</script>
