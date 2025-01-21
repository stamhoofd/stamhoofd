<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="periods" class="member-payments-view">
            <main class="container">
                <p v-if="hasFull" class="style-description-block">
                    {{ $t('237be7e0-4534-4008-b7bc-3e6db776a72a') }}
                </p>

                <div v-for="period of filteredPeriods" :key="period.id" class="container">
                    <hr>
                    <h2>{{ period.name }}</h2>
                    <p v-if="getMembershipsForPeriod(period.id).length === 0" class="warning-box">
                        {{ $t('65cbb5ad-4a6b-4800-a7db-59627fb576ef', {werkjaar: period.name}) }}
                    </p>

                    <STList v-else>
                        <STListItem v-for="membership of getMembershipsForPeriod(period.id)" :key="membership.id" class="right-stack">
                            <template #left>
                                <figure class="style-image-with-icon" :class="{'theme-secundary': membership.isTrial}">
                                    <figure>
                                        <span class="icon membership" />
                                    </figure>
                                    <aside v-if="membership.endDate > now">
                                        <span v-if="membership.startDate > now" class="icon small clock" />
                                        <span v-else-if="membership.expireDate && membership.expireDate < now" class="icon small warning" />
                                        <span v-else-if="membership.isTrial" class="icon trial stroke small secundary" />
                                        <span v-else class="icon small success primary" />
                                    </aside>
                                </figure>
                            </template>

                            <p v-if="membership.isTrial" class="style-title-prefix-list theme-secundary">
                                <span>Proefperiode</span>
                            </p>
                            <h3 class="style-title-list">
                                <span>{{ getMembershipType(membership).name }}</span>

                                <span v-if="membership.freeAmount" class="style-tag discount inline-first">
                                    {{ Formatter.pluralText(membership.freeAmount, 'dag', 'dagen') }} gratis
                                </span>
                            </h3>
                            <p class="style-description-small">
                                {{ formatStartDate(membership.startDate, false, true) }} tot en met {{ formatEndDate(membership.expireDate ?? membership.endDate, false, true) }}
                            </p>
                            <p v-if="membership.trialUntil" class="style-description-small">
                                Proefperiode tot {{ formatDate(membership.trialUntil, true) }}
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

                            <p v-if="membership.generated && auth.hasPlatformFullAccess()" class="style-description-small">
                                {{ $t('41464f90-088a-4c6a-827b-cd5907ad1fac') }}
                            </p>
                            <p v-if="membership.balanceItemId && auth.hasPlatformFullAccess()" class="style-description-small">
                                {{ $t('8e515034-5d58-4042-84e6-7e32943dbdec') }}
                            </p>

                            <template v-if="hasFull && !period.locked && (!organization || membership.organizationId === organization.id)" #right>
                                <span v-if="membership.price === membership.priceWithoutDiscount || membership.priceWithoutDiscount === 0" class="style-price-base">{{ formatPrice(membership.price) }}</span>
                                <template v-else>
                                    <span class="style-discount-old-price">{{ formatPrice(membership.priceWithoutDiscount) }}</span>
                                    <span class="style-discount-price">{{ formatPrice(membership.price) }}</span>
                                </template>

                                <LoadingButton v-if="(!membership.generated || !isRegisteredAt(period.id, membership.organizationId)) && (!membership.balanceItemId || auth.hasPlatformFullAccess())" :loading="deletingMemberships.has(membership.id)">
                                    <button class="button icon trash" type="button" @click="deleteMembership(membership)" />
                                </LoadingButton>
                            </template>
                        </STListItem>
                    </STList>

                    <p v-if="hasFull && !period.locked">
                        <button type="button" class="button text" @click="addMembership(period)">
                            <span class="icon add" />
                            <span>Aansluiting of verzekering toevoegen in {{ period.name }}</span>
                        </button>
                    </p>
                </div>
            </main>
        </div>
    </LoadingBoxTransition>
</template>

<script lang="ts" setup>
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { GroupType, MemberPlatformMembership, MemberWithRegistrationsBlob, PlatformMember, PlatformMembershipType, RegistrationPeriod } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { LoadingBoxTransition } from '../../containers';
import { ErrorBox } from '../../errors/ErrorBox';
import { useErrors } from '../../errors/useErrors';
import { useAuth, useOrganization, usePlatform } from '../../hooks';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '../../overlays/Toast';
import { usePlatformFamilyManager } from '../PlatformFamilyManager';
import SelectPlatformMembershipView from '../components/platform-membership/SelectPlatformMembershipView.vue';

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
const platformManager = usePlatformManager();
const owner = useRequestOwner();
const errors = useErrors();
platformManager.value.loadPeriods(false, true, owner).catch(e => errors.errorBox = new ErrorBox(e));
const periods = computed(() => platformManager.value.$platform.periods);
const organization = useOrganization();

function isRegisteredAt(periodId: string, organizationId: string) {
    return props.member.filterRegistrations({ types: [GroupType.Membership], periodId, organizationId }).length > 0;
}

const memberships = computed(() => {
    return [...props.member.member.platformMemberships]
        .sort((a, b) => Sorter.stack(
            Sorter.byDateValue(b.startDate, a.startDate),
            Sorter.byDateValue(b.createdAt, a.createdAt),
        ));
});

const filteredPeriods = computed(() => {
    return periods.value?.filter(p => p.id === organization.value?.period?.period.id || (p.id === platform.value.period.id) || memberships.value.some(m => m.periodId === p.id)) ?? [];
});

function getMembershipsForPeriod(periodId: string) {
    return memberships.value.filter(m => m.periodId === periodId);
}

function getOrganizationName(membership: MemberPlatformMembership) {
    return props.member.organizations.find(o => o.id === membership.organizationId)?.name ?? 'Onbekende groep';
}

async function addMembership(period: RegistrationPeriod) {
    await present({
        components: [
            new ComponentWithProperties(SelectPlatformMembershipView, {
                member: props.member,
                period,
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
