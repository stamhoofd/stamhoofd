<template>
    <div class="st-view">
        <STNavigationBar :title="member.member.details.name">
            <template #right>
                <button v-tooltip="'Lid bewerken'" class="button icon navigation edit" type="button" @click="doEdit" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title">
                {{ member.member.details.name }}
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
import { useEditMember, useIsMobile, ViewMemberAccountsBox, ViewMemberActionsBox, ViewMemberEmergencyContactsBox, ViewMemberGeneralBox, ViewMemberParentsBox, ViewMemberRecordCategoriesBox, ViewMemberRegistrationsBox } from '@stamhoofd/components';
import { PlatformMember } from '@stamhoofd/structures';

const props = defineProps<{
    member: PlatformMember
}>();
const editMember = useEditMember();
async function doEdit() {
    await editMember(props.member, {title: 'Gegevens bewerken'});
}

</script>
