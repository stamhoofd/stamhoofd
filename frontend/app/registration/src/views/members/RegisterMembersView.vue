<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <h1>{{ title }}</h1>

            <STList class="illustration-list">
                <STListItem v-for="member in members" :key="member.member.id" class="right-stack" :selectable="true" @click.stop="selectMember(member)">
                    <template #left>
                        <MemberIcon :member="member" />
                    </template>

                    <h2 class="style-title-list">
                        {{ member.patchedMember.name }}
                    </h2>
                    <p v-if="member.patchedMember.details.birthDayFormatted" class="style-description-small">
                        {{ member.patchedMember.details.birthDayFormatted }}
                    </p>

                    <template #right>
                        <span v-if="user && member.id === user.memberId" v-color="member" class="style-tag">Dit ben jij</span>
                        <span class="icon gray arrow-right-small" />
                    </template>
                </STListItem>

                <STListItem v-if="isAcceptingNewMembers" class="right-stack" :selectable="true" @click="addNewMember">
                    <template #left>
                        <span class="icon add" />
                    </template>

                    <h2 class="style-title-list">
                        Nieuw lid toevoegen
                    </h2>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { MemberIcon, useAddMember, useChooseGroupForMember, useUser } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useMemberManager } from '../../getRootView';

const memberManager = useMemberManager();
const members = computed(() => memberManager.family.members);
const title = 'Wie wil je inschrijven?'
const user = useUser();

const isAcceptingNewMembers = computed(() => memberManager.isAcceptingNewMembers);
const chooseGroupForMember = useChooseGroupForMember()
const addMember = useAddMember()

async function selectMember(member: PlatformMember) {
    await chooseGroupForMember({member, displayOptions: {action: 'show'}})
}

async function addNewMember() {
    await addMember(memberManager.family, {
        displayOptions: {action: 'show'},
        async finishHandler(member, navigate) {
            await chooseGroupForMember({
                member,
                displayOptions: {action: 'show', replace: 100, force: true},
                customNavigate: navigate
            })
        },
    });
}
</script>
