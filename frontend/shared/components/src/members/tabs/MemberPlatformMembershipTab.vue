<template>
    <div class="member-payments-view">
        <main class="container">
            <p class="info-box">Leden die je inschrijft in een leeftijdsgroep die je koppelt aan een standaard leeftijdsgroep van KSA Nationaal worden automatisch aangesloten. Voor andere leden kan je hier een aansluiting manueel aanvragen.</p>
            <p v-if="memberships.length === 0" class="warning-box">
                {{ $t('shared.noMembershipWarning') }}
            </p>
            <STList v-else>
                <STListItem v-for="membership of memberships" :key="membership.id" class="right-stack">
                    <template #left>
                        <span class="icon clock" v-if="membership.startDate > now" />
                        <span class="icon warning" v-else-if="membership.expireDate && membership.expireDate < now" />
                        <span class="icon success" v-else />
                    </template>
                    <h3 class="style-title-list">{{ getMembershipType(membership).name }}</h3>
                    <p class="style-description-small">
                        {{ formatDate(membership.startDate, true) }} tot en met {{ formatDate(membership.expireDate ?? membership.endDate, true) }}
                    </p>
                    <p class="style-description-small" v-if="membership.expireDate && membership.expireDate < now && membership.endDate > now">
                        Verlopen. Verleng de aansluiting om de verzekering te behouden.
                    </p>

                    <p class="style-description-small">{{ getMembershipType(membership).description }}</p>

                    <template #right>
                        <span>{{ formatPrice(membership.price) }}</span>
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
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberPlatformMembership, MemberWithRegistrationsBlob, PlatformMember, PlatformMembershipType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { Toast } from '../../overlays/Toast';
import { usePlatformFamilyManager } from '../PlatformFamilyManager';
import SelectPlatformMembershipView from '../components/platform-membership/SelectPlatformMembershipView.vue';
import { usePlatform } from '../../hooks';

const props = defineProps<{
    member: PlatformMember
}>();
const $t = useTranslate();
const present = usePresent()
const platformFamilyManager = usePlatformFamilyManager()
const deletingMemberships = ref(new Set());
const platform = usePlatform();
const now = new Date();

const memberships = computed(() => {
    return props.member.member.platformMemberships.filter(m => m.endDate >= now);
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

function getMembershipType(membership: MemberPlatformMembership) {
    return platform.value.config.membershipTypes.find(t => t.id === membership.membershipTypeId) ?? PlatformMembershipType.create({
        id: membership.membershipTypeId,
        name: 'Onbekend'
    });
}
</script>
