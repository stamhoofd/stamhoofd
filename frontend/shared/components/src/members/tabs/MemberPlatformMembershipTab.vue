<template>
    <div class="member-payments-view">
        <main class="container">
            <p v-if="hasFull" class="style-description-block">
                {{ $t('237be7e0-4534-4008-b7bc-3e6db776a72a') }}
            </p>

            <p v-if="memberships.length === 0" class="warning-box">
                {{ $t('60871aaf-1b90-4a7c-a755-a4aeb0585a8e') }}
            </p>

            <STList v-else>
                <STListItem v-for="membership of memberships" :key="membership.id" class="right-stack">
                    <template #left>
                        <span v-if="membership.startDate > now" class="icon clock" />
                        <span v-else-if="membership.expireDate && membership.expireDate < now" class="icon warning" />
                        <span v-else class="icon success" />
                    </template>
                    <h3 class="style-title-list">
                        <span>{{ getMembershipType(membership).name }}</span>

                        <span v-if="membership.freeAmount" class="style-tag discount inline-first">
                            {{ Formatter.pluralText(membership.freeAmount, 'dag', 'dagen') }} gratis
                        </span>
                    </h3>
                    <p class="style-description-small">
                        {{ formatStartDate(membership.startDate, false, true) }} tot en met {{ formatEndDate(membership.expireDate ?? membership.endDate, false, true) }}
                    </p>
                    <p class="style-description-small">
                        Toegevoegd op {{ formatDate(membership.createdAt, true) }}
                    </p>
                    <p class="style-description-small">
                        Via {{ getOrganizationName(membership) }}
                    </p>
                    <p v-if="membership.expireDate && membership.expireDate < now && membership.endDate > now" class="style-description-small">
                        Verlopen. Verleng de aansluiting om de verzekering te behouden.
                    </p>

                    <p v-if="membership.balanceItemId && auth.hasFullPlatformAccess()" class="style-description-small">
                        Deze aansluiting werd al aangerekend.
                    </p>

                    <p v-if="membership.generated && auth.hasFullPlatformAccess()" class="style-description-small">
                        Deze aansluiting werd automatisch aangemaakt.
                    </p>

                    <template v-if="hasFull" #right>
                        <span v-if="membership.price === membership.priceWithoutDiscount || membership.priceWithoutDiscount === 0" class="style-price-base">{{ formatPrice(membership.price) }}</span>
                        <template v-else>
                            <span class="style-discount-old-price">{{ formatPrice(membership.priceWithoutDiscount) }}</span>
                            <span class="style-discount-price">{{ formatPrice(membership.price) }}</span>
                        </template>

                        <LoadingButton v-if="!membership.generated" :loading="deletingMemberships.has(membership.id)">
                            <button class="button icon trash" type="button" @click="deleteMembership(membership)" />
                        </LoadingButton>
                    </template>
                </STListItem>
            </STList>

            <p v-if="hasFull">
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
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useAuth, usePlatform } from '../../hooks';
import { Toast } from '../../overlays/Toast';
import { usePlatformFamilyManager } from '../PlatformFamilyManager';
import SelectPlatformMembershipView from '../components/platform-membership/SelectPlatformMembershipView.vue';
import { CenteredMessage } from '../../overlays/CenteredMessage';

const props = defineProps<{
    member: PlatformMember;
}>();
const $t = useTranslate();
const present = usePresent();
const platformFamilyManager = usePlatformFamilyManager();
const deletingMemberships = ref(new Set());
const platform = usePlatform();
const now = new Date();
const auth = useAuth();
const hasFull = auth.hasFullAccess();

const memberships = computed(() => {
    return props.member.member.platformMemberships
        .filter(m => m.endDate >= now)
        .sort((a, b) => Sorter.stack(
            Sorter.byDateValue(b.startDate, a.startDate),
            Sorter.byDateValue(b.createdAt, a.createdAt),
        ));
});

function getOrganizationName(membership: MemberPlatformMembership) {
    return props.member.organizations.find(o => o.id === membership.organizationId)?.name ?? 'Onbekende groep';
}

async function addMembership() {
    await present({
        components: [
            new ComponentWithProperties(SelectPlatformMembershipView, {
                member: props.member,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function deleteMembership(membership: MemberPlatformMembership) {
    if (deletingMemberships.value.has(membership.id)) {
        return;
    }

    if (!await CenteredMessage.confirm('Ben je zeker dat je deze aansluiting wilt verwijderen?', 'Ja, verwijderen')) {
        return;
    }

    deletingMemberships.value.add(membership.id);

    try {
        // Execute an isolated patch
        const platformMembershipsPatch = new PatchableArray() as PatchableArrayAutoEncoder<MemberPlatformMembership>;
        platformMembershipsPatch.addDelete(membership.id);

        const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        patch.addPatch(MemberWithRegistrationsBlob.patch({
            id: props.member.member.id,
            platformMemberships: platformMembershipsPatch,
        }));

        await platformFamilyManager.isolatedPatch([props.member], patch, false);

        Toast.success('Aansluiting verwijderd').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    deletingMemberships.value.delete(membership.id);
}

function getMembershipType(membership: MemberPlatformMembership) {
    return platform.value.config.membershipTypes.find(t => t.id === membership.membershipTypeId) ?? PlatformMembershipType.create({
        id: membership.membershipTypeId,
        name: 'Onbekend',
    });
}
</script>
