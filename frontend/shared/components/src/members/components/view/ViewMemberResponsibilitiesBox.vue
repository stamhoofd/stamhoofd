<template>
    <div v-if="hasResponsibilities && (sortedResponsibilities.length || auth.hasFullAccess())" class="hover-box container">
        <hr><h2 class="style-with-button">
            <div>{{ $t('fbfaabbf-95d2-49ae-900b-d7b2321907bb') }}</div>
            <div class="hover-show">
                <button v-if="auth.hasFullAccess()" type="button" class="button icon edit gray" @click.prevent="editResponsibilities" />
            </div>
        </h2>

        <button v-if="sortedResponsibilities.length === 0" class="info-box selectable with-button" type="button" @click="editResponsibilities">
            {{ $t('c1253fe5-e16e-47c2-aa49-93815efe79f4', {member: props.member.patchedMember.details.firstName}) }}

            <span class="button text">
                {{ $t('ad3ad207-6470-4f3e-aaf4-1ea5ea8b85ad') }}
            </span>
        </button>

        <STList v-else>
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
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();

const platform = usePlatform();
const organization = useOrganization();
const auth = useAuth();
const hasResponsibilities = computed(() => ((platform.value.config.responsibilities.length > 0 || (organization.value && organization.value.privateMeta?.responsibilities?.length)) && props.member.patchedMember.details.defaultAge >= 16) || responsibilities.value.length);
const responsibilities = computed(() => props.member.getResponsibilities({ organization: organization.value ?? undefined }));
const buildActions = useMemberActions();

const nationalResponsibilities = computed(() => {
    return platform.value.config.responsibilities.filter(r => !r.organizationBased);
});

const organizationResponsibilities = computed(() => {
    return platform.value.config.responsibilities.filter(r => r.organizationBased);
});

function getResponsibilityIndex(responsibility: MemberResponsibilityRecord) {
    let index = nationalResponsibilities.value.findIndex(r => r.id === responsibility.responsibilityId);
    if (index !== -1) {
        return index;
    }

    index = organizationResponsibilities.value.findIndex(r => r.id === responsibility.responsibilityId);
    if (index !== -1) {
        return index + nationalResponsibilities.value.length;
    }

    const org = responsibility.organizationId ? props.member.organizations.find(o => o.id === responsibility.organizationId) : null;
    if (org && org.privateMeta) {
        const organizationIndex = org.privateMeta.responsibilities.findIndex(r => r.id === responsibility.responsibilityId);
        if (organizationIndex !== -1) {
            return organizationIndex + platform.value.config.responsibilities.length;
        }
        return org.privateMeta.responsibilities.length + platform.value.config.responsibilities.length;
    }

    return platform.value.config.responsibilities.length;
}

const sortedResponsibilities = computed(() => {
    // Sort based on index in platform.value.config.responsibilities, followed by index in organization.value.privateMeta.responsibilities
    return responsibilities.value.slice().sort((a, b) => {
        return getResponsibilityIndex(a) - getResponsibilityIndex(b);
    });
});

async function editResponsibilities() {
    buildActions().editResponsibilities(props.member);
}
</script>
