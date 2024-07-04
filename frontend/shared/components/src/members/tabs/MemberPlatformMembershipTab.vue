<template>
    <div class="member-payments-view">
        <main class="container">
            <p class="info-box" v-if="memberships.length === 0">{{ $t('shared.noMembershipWarning') }}</p>
            <STList v-else>
                <STListItem v-for="membership of memberships" :key="membership.id">
                    todo

                    <template #right>
                        <LoadingButton :loading="deletingMemberships.has(membership.id)">
                            <button class="button icon trash" type="button" @click="deleteMembership(membership)" />
                        </LoadingButton>
                    </template>
                </STListItem>
            </STList>

            <p>
                <button type="button" class="button text" @click="addMembership">
                    <span class="icon add" />
                    <span>Aansluiting of verzekering toevoegen</span>
                </button>
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberPlatformMembership, MemberWithRegistrationsBlob, PlatformMember } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import SelectPlatformMembershipView from '../components/platform-membership/SelectPlatformMembershipView.vue';
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePlatformFamilyManager } from '../PlatformFamilyManager';
import { Toast } from '../../overlays/Toast';

const props = defineProps<{
    member: PlatformMember
}>();
const $t = useTranslate();
const present = usePresent()
const platformFamilyManager = usePlatformFamilyManager()
const deletingMemberships = ref(new Set());

const memberships = computed(() => {
    return props.member.member.platformMemberships
});

async function addMembership() {
    await present({
        components: [
            new ComponentWithProperties(SelectPlatformMembershipView, {
                member: props.member
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function deleteMembership(membership: MemberPlatformMembership) {
    if (deletingMemberships.value.has(membership.id)) {
        return;
    }

    deletingMemberships.value.add(membership.id);

    try {
        // Execute an isolated patch
        const platformMembershipsPatch = new PatchableArray() as PatchableArrayAutoEncoder<MemberPlatformMembership>;
        platformMembershipsPatch.addDelete(membership.id)

        const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        patch.addPatch(MemberWithRegistrationsBlob.patch({
            id: props.member.member.id,
            platformMemberships: platformMembershipsPatch
        }))

        await platformFamilyManager.isolatedPatch([props.member], patch, false)

        Toast.success('Aansluiting verwijderd').show();
    } catch (e) {
        Toast.fromError(e).show();
    }
    deletingMemberships.value.delete(membership.id);
}
</script>
