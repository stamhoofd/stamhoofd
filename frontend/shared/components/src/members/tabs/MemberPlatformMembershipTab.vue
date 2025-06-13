<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="periods" class="member-payments-view">
            <main class="container">
                <p v-if="hasFull" class="style-description-block">
                    {{ $t('237be7e0-4534-4008-b7bc-3e6db776a72a') }}
                </p>

                <div v-for="period of filteredPeriods" :key="period.id" class="container">
                    <hr><h2>{{ period.name }}</h2>
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
                                <span>{{ $t('4d4c0732-2875-4de8-afae-d8b2687ff279') }}</span>
                            </p>
                            <h3 class="style-title-list">
                                <span>{{ getMembershipType(membership).name }}</span>

                                <span v-if="membership.freeAmount" class="style-tag discount inline-first">
                                    {{ $t('577e6929-3751-47ae-9653-e43e10978119', {days: Formatter.pluralText(membership.freeAmount, $t('a6279389-a070-49c9-a085-bb312555e419'), $t('fca0ce20-d696-4966-a50c-441f54f046c4'))}) }}
                                </span>
                            </h3>
                            <p v-tooltip="$t('af4f2898-e5a5-4f08-a6c3-62c389e793e9', {date: formatDate(membership.createdAt, true)})" class="style-description-small style-tooltip">
                                {{ capitalizeFirstLetter(formatDateRange(membership.startDate, membership.expireDate ?? membership.endDate)) }}
                            </p>
                            <p v-if="membership.trialUntil && membership.trialUntil > now" class="style-description-small">
                                {{ $t('c38818cb-2337-451b-afac-69f22b700d43', {date: formatDate(membership.trialUntil, true)}) }}
                            </p>
                            <p v-else-if="membership.trialUntil" class="style-description-small">
                                {{ $t('892b70a8-6bba-4c41-9d82-b7db955f3aa2', {date: formatDate(membership.trialUntil, true)}) }}
                            </p>

                            <p v-if="membership.organizationId === platform.membershipOrganizationId" class="style-description-small">
                                {{ $t('4a39e12b-efa2-46fe-aa30-83bc576548a3') }}
                            </p>
                            <template v-else>
                                <p v-if="membership.price === 0" class="style-description-small">
                                    {{ $t('c8f1e4d4-669c-4ccb-a9d9-30584f6c2d55', {organization: getOrganizationName(membership)}) }}
                                </p>
                                <p v-else-if="membership.balanceItemId" class="style-description-small">
                                    {{ $t('f1582fe7-3168-4579-bcc5-9db17568dac0', {organization: getOrganizationName(membership)}) }}
                                </p>
                                <p v-else-if="membership.trialUntil && membership.trialUntil > now" class="style-description-small">
                                    {{ $t('b0a70381-66b1-4bff-a613-8332a35bec7a', {organization: getOrganizationName(membership)}) }}
                                </p>
                                <p v-else class="style-description-small">
                                    {{ $t('a2f6d632-9e20-4366-9393-b52431525596', {organization: getOrganizationName(membership)}) }}
                                </p>
                            </template>

                            <p v-if="membership.expireDate && membership.expireDate < now && membership.endDate > now" class="style-description-small">
                                {{ $t('a74f6f39-1eb6-45c4-96e2-6719d9a4401d') }}
                            </p>

                            <p v-if="membership.generated && auth.hasPlatformFullAccess()" class="style-description-small">
                                {{ $t('41464f90-088a-4c6a-827b-cd5907ad1fac') }}
                            </p>
                            <template v-if="hasFull && (!organization || membership.organizationId === organization.id)" #right>
                                <span v-if="membership.price === 0 && (membership.organizationId === platform.membershipOrganizationId || period.locked)" />
                                <span v-else-if="membership.price === membership.priceWithoutDiscount || membership.priceWithoutDiscount === 0" class="style-price-base">{{ formatPrice(membership.price) }}</span>
                                <template v-else>
                                    <span class="style-discount-old-price">{{ formatPrice(membership.priceWithoutDiscount) }}</span>
                                    <span class="style-discount-price">{{ formatPrice(membership.price) }}</span>
                                </template>

                                <LoadingButton v-if="!membership.locked && (!membership.generated || !isRegisteredAt(period.id, membership.organizationId)) && (!membership.balanceItemId || auth.hasPlatformFullAccess())" :loading="deletingMemberships.has(membership.id)">
                                    <button class="button icon trash" type="button" @click="deleteMembership(membership)" />
                                </LoadingButton>

                                <button v-if="membership.locked && (auth.hasPlatformFullAccess())" v-tooltip="$t('b1c11fd1-81dc-46f2-8cfb-0ba02d260f19')" class="button icon lock" type="button" @click="unlockMembership(membership)" />
                            </template>
                        </STListItem>
                    </STList>

                    <p v-if="hasFull && !period.locked">
                        <button type="button" class="button text" @click="addMembership(period)">
                            <span class="icon add" />
                            <span>{{ $t('9a60989a-61d2-4596-adac-d9ec6befe218', {period: period.name}) }}</span>
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

const present = usePresent();
const platformFamilyManager = usePlatformFamilyManager();
const deletingMemberships = ref(new Set());
const patchingMemberships = ref(new Set());
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
    return props.member.filterRegistrations({
        types: [GroupType.Membership],
        periodId,
        organizationId,
        defaultAgeGroupIds: platform.value.config.defaultAgeGroups.filter(g => !!g.defaultMembershipTypeId).map(g => g.id),
    }).length > 0;
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
    return props.member.organizations.find(o => o.id === membership.organizationId)?.name ?? $t(`eb6d556a-bcda-4ab4-ad39-3215b4734569`);
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

    if (!await CenteredMessage.confirm($t(`4ab30ed5-3e8e-43ca-b87e-dddf8dd8b5fe`), $t(`3e204a5f-3198-4125-ac32-fcf973e144b2`))) {
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

        Toast.success($t(`63b9a0c4-ee88-49b4-8609-dc014bc3e3a3`)).show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    deletingMemberships.value.delete(membership.id);
}

async function unlockMembership(membership: MemberPlatformMembership) {
    if (patchingMemberships.value.has(membership.id)) {
        return;
    }

    if (!await CenteredMessage.confirm($t('6468d392-6711-48cd-9602-a5a26afe6f22'), $t('ac1d3647-1c2f-48a1-a08a-ce4821103fb1'))) {
        return;
    }

    patchingMemberships.value.add(membership.id);

    try {
        // Execute an isolated patch
        const platformMembershipsPatch = new PatchableArray() as PatchableArrayAutoEncoder<MemberPlatformMembership>;
        platformMembershipsPatch.addPatch(MemberPlatformMembership.patch({
            id: membership.id,
            locked: false,
        }));

        const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        patch.addPatch(MemberWithRegistrationsBlob.patch({
            id: props.member.member.id,
            platformMemberships: platformMembershipsPatch,
        }));

        await platformFamilyManager.isolatedPatch([props.member], patch, false);

        Toast.success($t('04cac345-ed28-484c-8a50-96ac4db89911')).show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    patchingMemberships.value.delete(membership.id);
}

function getMembershipType(membership: MemberPlatformMembership) {
    return platform.value.config.membershipTypes.find(t => t.id === membership.membershipTypeId) ?? PlatformMembershipType.create({
        id: membership.membershipTypeId,
        name: $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`),
    });
}
</script>
