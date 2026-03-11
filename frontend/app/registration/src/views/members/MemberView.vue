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
import { useAppContext, useEditMember, ViewMemberAccountsBox, ViewMemberActionsBox, ViewMemberEmergencyContactsBox, ViewMemberGeneralBox, ViewMemberParentsBox, ViewMemberRecordCategoriesBox, ViewMemberRegistrationsBox } from '@stamhoofd/components';
import { Gender, PlatformMember } from '@stamhoofd/structures';

const props = defineProps<{
    member: PlatformMember;
}>();

const editMember = useEditMember();
const app = useAppContext();

async function doEdit() {
    await editMember(props.member, { title: $t(`%XO`) });
}

</script>
