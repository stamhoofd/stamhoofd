<template>
    <div class="st-view" data-testid="member-view">
        <STNavigationBar :title="member.member.details.name">
            <template #right>
                <button :v-tooltip="$t('%XO')" class="button icon edit" type="button" data-testid="edit-member-button" @click="doEdit" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ member.member.details.name }}</span>
                <span v-if="member.member.details.gender === Gender.Male" :v-tooltip="member.member.details.defaultAge >= 18 ? $t('%XK') : $t('%XL')" class="icon male blue icon-spacer" />
                <span v-if="member.member.details.gender === Gender.Female" :v-tooltip="member.member.details.defaultAge >= 18 ? $t('%XM') : $t('%XN')" class="icon female pink icon-spacer" />
            </h1>

            <div class="member-view-details split">
                <div>
                    <ViewMemberGeneralBox :member="member" />
                    <ViewMemberRegistrationsBox :member="member" />
                    <ViewMemberParentsBox :member="member" />
                    <ViewMemberEmergencyContactsBox :member="member" />
                    <ViewMemberRecordCategoriesBox :member="member" />
                </div>

                <div>
                    <ViewMemberActionsBox :member="member" />
                    <ViewMemberAccountsBox :member="member" />
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import ViewMemberAccountsBox from '@stamhoofd/components/members/components/view/ViewMemberAccountsBox.vue';
import ViewMemberActionsBox from '@stamhoofd/components/members/components/view/ViewMemberActionsBox.vue';
import ViewMemberEmergencyContactsBox from '@stamhoofd/components/members/components/view/ViewMemberEmergencyContactsBox.vue';
import ViewMemberGeneralBox from '@stamhoofd/components/members/components/view/ViewMemberGeneralBox.vue';
import ViewMemberParentsBox from '@stamhoofd/components/members/components/view/ViewMemberParentsBox.vue';
import ViewMemberRecordCategoriesBox from '@stamhoofd/components/members/components/view/ViewMemberRecordCategoriesBox.vue';
import ViewMemberRegistrationsBox from '@stamhoofd/components/members/components/view/ViewMemberRegistrationsBox.vue';
import { useEditMember } from '@stamhoofd/components/members/hooks/useEditMember.ts';
import type { PlatformMember } from '@stamhoofd/structures';
import { Gender } from '@stamhoofd/structures';

const props = defineProps<{
    member: PlatformMember;
}>();

const editMember = useEditMember();

async function doEdit() {
    await editMember(props.member, { title: $t(`%XO`) });
}

</script>
