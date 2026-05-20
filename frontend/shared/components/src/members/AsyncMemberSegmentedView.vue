<template>
    <LoadingViewTransition>
        <MemberSegmentedView v-if="member" :member="member" />
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import type { PlatformMember } from '@stamhoofd/structures';
import { PlatformFamily } from '@stamhoofd/structures';
import { ref } from 'vue';
import LoadingViewTransition from '../containers/LoadingViewTransition.vue';
import { useOrganization, usePlatform } from '../hooks';
import { useLoadFamilyFromId } from '../members';
import MemberSegmentedView from '../members/MemberSegmentedView.vue';
import { Toast } from '../overlays/Toast';

const props = defineProps<{
    memberId: string
}>();

const member = ref<PlatformMember | null>(null);
const loadFamilyFromId = useLoadFamilyFromId();
const dismiss = useDismiss();

const platform = usePlatform();
const organization = useOrganization();

async function fetchMember(id: string): Promise<PlatformMember> {
    const blob = await loadFamilyFromId(id);
    const family = PlatformFamily.create(blob, {
        platform: platform.value,
        contextOrganization: organization.value,
    });
    return family.members.find(m => m.id === id)!;
}

fetchMember(props.memberId)
.then(m => member.value = m)
.catch(error => {
    console.error(error);
    Toast.error($t('%1U7')).show();
    dismiss().catch(console.error);
});
</script>
