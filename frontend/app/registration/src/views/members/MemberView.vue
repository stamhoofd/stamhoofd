<template>
    <div class="st-view" data-testid="member-view">
        <STNavigationBar :title="member.member.details.name">
            <template #right>
                <button :v-tooltip="$t('f2eb0c04-0dca-4c8e-b920-7044a65aee6a')" class="button icon edit" type="button" data-testid="edit-member-button" @click="doEdit" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ member.member.details.name }}</span>
                <span v-if="member.member.details.gender === Gender.Male" :v-tooltip="member.member.details.defaultAge >= 18 ? $t('b54b9706-4c0c-46a6-9027-37052eb76b28') : $t('177eba5b-b06f-49dd-8d48-578934c635bb')" class="icon male blue icon-spacer" />
                <span v-if="member.member.details.gender === Gender.Female" :v-tooltip="member.member.details.defaultAge >= 18 ? $t('06466432-eca6-41d0-a3d6-f262f8d6d2ac') : $t('dba51db1-ce45-4e09-9a2f-fcea4a7fa46e')" class="icon female pink icon-spacer" />
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
    await editMember(props.member, { title: $t(`28f20fae-6270-4210-b49d-68b9890dbfaf`) });
}

</script>
