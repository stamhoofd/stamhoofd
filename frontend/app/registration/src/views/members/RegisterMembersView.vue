<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <h1>{{ title }}</h1>

            <STList class="illustration-list">
                <STListItem v-for="member in members" :key="member.member.id" class="right-stack" :selectable="true" @click.stop="selectMember(member)">
                    <template #left>
                        <img v-if="member.patchedMember.details.gender === 'Female'" src="@stamhoofd/assets/images/illustrations/member-female.svg">
                        <img v-else src="@stamhoofd/assets/images/illustrations/member-male.svg">
                    </template>

                    <h2 class="style-title-list">
                        {{ member.patchedMember.name }}
                    </h2>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="isAcceptingNewMembers" class="right-stack" :selectable="true" @click="addNewMember">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/account-add.svg">
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
import { ComponentWithProperties, NavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { EditMemberGeneralBox, MemberStepView, NavigationActions, useChooseGroupForMember } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';
import { computed, markRaw, reactive } from 'vue';
import { useMemberManager } from '../../getRootView';

const memberManager = useMemberManager();
const members = computed(() => memberManager.family.members);
const title = 'Wie wil je inschrijven?'
const show = useShow();

const isAcceptingNewMembers = computed(() => memberManager.isAcceptingNewMembers);
const chooseGroupForMember = useChooseGroupForMember()

async function selectMember(member: PlatformMember) {
   await chooseGroupForMember({member, displayOptions: {action: 'show'}})
}

async function addNewMember() {
    const clonedFamily = memberManager.family.clone();
    const member = reactive(clonedFamily.newMember() as any) as PlatformMember

    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(MemberStepView, {
            title: 'Nieuw lid inschrijven',
            member,
            component: markRaw(EditMemberGeneralBox),
            saveHandler: async (navigate: NavigationActions) => {
                memberManager.family.copyFromClone(clonedFamily)
                await chooseGroupForMember({
                    member, 
                    displayOptions: {action: 'show', replace: 100, force: true},
                    customNavigate: navigate
                })
            }
        }),
    });

    await show({
        components: [
            component
        ]
    })
}
</script>
