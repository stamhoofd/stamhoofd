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
import { ComponentWithProperties, NavigationController, defineRoutes, useNavigate, useShow } from '@simonbackx/vue-app-navigation';
import { PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, markRaw, reactive } from 'vue';
import {EditMemberGeneralBox, MemberStepView, NavigationActions, ChooseGroupForMemberView} from '@stamhoofd/components'
import { useMemberManager } from '../../getRootView';

const memberManager = useMemberManager();
const $navigate = useNavigate();
const members = computed(() => memberManager.family.members);
const title = 'Wie wil je inschrijven?'
const show = useShow();

enum Routes {
    RegisterMember = 'registerMember',
}
defineRoutes([
    {
        name: Routes.RegisterMember,
        url: '@name',
        component: ChooseGroupForMemberView as any,
        params: {
            name: String
        },
        paramsToProps(params) {
            const member = members.value.find(m => Formatter.slug(m.member.firstName) === params.name);
            if (!member) {
                throw new Error("Member not found");
            }

            return {
                member
            }
        },
        propsToParams(props) {
            if (!("member" in props) || !(props.member instanceof PlatformMember)) {
                throw new Error("Member is required");
            }

            return { 
                params: {
                    name: Formatter.slug(props.member.patchedMember.firstName)
                }
            }
        }
    }
])

const isAcceptingNewMembers = computed(() => memberManager.isAcceptingNewMembers);

async function selectMember(member: PlatformMember) {
    await $navigate(Routes.RegisterMember, { properties: { member } });
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
                await navigate.show({
                    force: true,
                    url: Formatter.slug(member.patchedMember.firstName),
                    components: [
                        new ComponentWithProperties(ChooseGroupForMemberView, {
                            member
                        })
                    ],
                    replace: 1
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
