<template>
    <div class="hover-box container" v-if="hasResponsibilities">
        <hr>
        <h2 class="style-with-button">
            <div>Functies</div>
            <div class="hover-show">
                <button v-if="auth.hasFullAccess()" type="button" class="button icon edit gray" @click.prevent="editResponsibilities" />
            </div>
        </h2>

        <STList>
            <ViewMemberResponsibilityRow v-for="responsibility in sortedResponsibilities" :key="responsibility.id" :member="member" :responsibility="responsibility" />
        </STList>

    </div>
</template>

<script setup lang="ts">
import { MemberResponsibilityRecord, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAuth, useOrganization, usePlatform } from '../../../hooks';
import { useMemberActions } from '../../classes/MemberActionBuilder';
import ViewMemberResponsibilityRow from './ViewMemberResponsibilityRow.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>()

const platform = usePlatform()
const organization = useOrganization()
const auth = useAuth()
const hasResponsibilities = computed(() => ((platform.value.config.responsibilities.length > 0 || (organization.value && organization.value.privateMeta?.responsibilities?.length)) && props.member.patchedMember.details.defaultAge >= 16) || responsibilities.value.length)
const responsibilities = computed(() => props.member.getResponsibilities(organization.value))
const buildActions = useMemberActions()

function getResponsibilityIndex(responsibility: MemberResponsibilityRecord) {
    const platformIndex = platform.value.config.responsibilities.findIndex(r => r.id === responsibility.responsibilityId);
    if (platformIndex !== -1) {
        return platformIndex;
    }

    if (organization.value && organization.value.privateMeta) {
        const organizationIndex = organization.value?.privateMeta.responsibilities.findIndex(r => r.id === responsibility.responsibilityId)
        if (organizationIndex !== -1) {
            return organizationIndex + platform.value.config.responsibilities.length;
        }
        return organization.value?.privateMeta.responsibilities.length + platform.value.config.responsibilities.length;
    }

    return platform.value.config.responsibilities.length
}

const sortedResponsibilities = computed(() => {
    // Sort based on index in platform.value.config.responsibilities, followed by index in organization.value.privateMeta.responsibilities
    return responsibilities.value.slice().sort((a, b) => {
        return getResponsibilityIndex(a) - getResponsibilityIndex(b)
    })
})

async function editResponsibilities() {
    await buildActions().editResponsibilities(props.member)
}
</script>
