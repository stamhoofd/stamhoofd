<template>
    <LoadingViewTransition :error-box="loadingOrganizationErrorBox">
        <div v-if="!loadingOrganization" class="st-view charge-memberships-view">
            <STNavigationBar :title="$t(`%tv`)" />

            <main class="center">
                <h1>
                    {{ $t('%GX') }}
                </h1>

                <STErrorsDefault :error-box="errors.errorBox" />

                <p v-if="summary && summary.running" class="info-box icon clock">
                    {{ $t('%Ge') }}
                </p>
                <template v-else>
                    <template v-if="membershipOrganization">
                        <hr><h2>{{ $t('%tx') }} {{ membershipOrganization.name }}</h2>

                        <STList class="illustration-list">
                            <STListItem :selectable="true" class="left-center" element-name="a" :href="'/' + appToUri('dashboard') + '/' + membershipOrganization.uri + '/boekhouding/exporteren'">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/calculator.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%95') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t("%5Q") }}
                                </p>
                                <template #right>
                                    <span class="icon external gray" />
                                </template>
                            </STListItem>

                            <STListItem :selectable="true" class="left-center" element-name="a" :href="'/' + appToUri('dashboard') + '/' + membershipOrganization.uri + '/boekhouding/overschrijvingen'">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/check-transfer.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%96') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('%97') }}
                                </p>
                                <template #right>
                                    <span class="icon external gray" />
                                </template>
                            </STListItem>

                            <STListItem :selectable="true" class="left-center" element-name="a" :href="'/' + appToUri('dashboard') + '/' + membershipOrganization.uri + '/boekhouding/betalingen'">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/creditcards.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%1Lo') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('%98') }}
                                </p>
                                <template #right>
                                    <span class="icon external gray" />
                                </template>
                            </STListItem>

                            <STListItem :selectable="true" class="left-center" element-name="a" :href="'/' + appToUri('dashboard') + '/' + membershipOrganization.uri + '/boekhouding/openstaande-bedragen'">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/outstanding-amount.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%99') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('%9A', {name: membershipOrganization!.name}) }}
                                </p>
                                <template #right>
                                    <span class="icon external gray" />
                                </template>
                            </STListItem>
                        </STList>
                    </template>
                    <hr><h2>
                        {{ $t('%tv') }}
                    </h2>
                    <p>
                        {{ $t("%9B") }}
                    </p>

                    <div class="style-stats-grid">
                        <STInputBox :title="$t(`%Gf`)">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatInteger(summary.memberships) }}
                                </span>
                            </p>
                        </STInputBox>

                        <STInputBox :title="$t(`%Gg`)">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatInteger(summary.members) }}
                                </span>
                            </p>
                        </STInputBox>

                        <STInputBox :title="$t(`%Gh`)">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatPrice(summary.price) }}
                                </span>
                            </p>
                        </STInputBox>

                        <STInputBox :title="$t(`%Gi`)">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatInteger(summary.organizations) }}
                                </span>
                            </p>
                        </STInputBox>
                    </div>

                    <p class="style-button-bar">
                        <LoadingButton :loading="charging">
                            <button class="button primary" type="button" @click="charge">
                                {{ $t('%6m') }}
                            </button>
                        </LoadingButton>
                    </p>
                    <p class="style-description-small">
                        {{ $t('%9C') }}
                    </p>

                    <hr><h2>
                        {{ $t('%9D') }}
                    </h2>
                    <p>
                        {{ $t('%9E') }}
                    </p>

                    <p v-if="membershipOrganization" class="info-box">
                        {{ $t('%9F') }}
                    </p>

                    <STList v-if="membershipOrganization">
                        <STListItem :selectable="true" @click="chooseMembershipOrganization">
                            <template #left>
                                <OrganizationAvatar :organization="membershipOrganization" />
                            </template>

                            <h3 class="style-title-list">
                                {{ membershipOrganization.name }}
                            </h3>

                            <template #right>
                                <span class="button text">
                                    {{ $t('%1Bm') }}
                                    <span class="icon arrow-right-small" />
                                </span>
                            </template>
                        </STListItem>
                    </STList>
                    <p v-else class="warning-box with-button selectable" @click="chooseMembershipOrganization">
                        {{ $t('%9G') }}

                        <button class="button text" type="button">
                            {{ $t('%9H') }}
                        </button>
                    </p>

                    <p v-if="hasChanges" class="style-button-bar">
                        <LoadingButton :loading="saving">
                            <button class="button primary" type="button" @click="save">
                                {{ $t('%v7') }}
                            </button>
                        </LoadingButton>
                    </p>

                    <div v-if="summary && summary?.trials.members > 0" class="container">
                        <hr><h2>{{ $t('%7r') }}</h2>

                        <div class="style-stats-grid">
                            <STInputBox :title="$t('%M4')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(summary.trials.memberships) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('%Gg')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(summary.trials.members) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('%Gh')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatPrice(summary.trials.price) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('%7m')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(summary.trials.organizations) }}
                                    </span>
                                </p>
                            </STInputBox>
                        </div>
                    </div>

                    <div v-for="type of platform.config.membershipTypes" :key="type.id" class="container">
                        <hr><h2>{{ $t('%X') }} "{{ type.name }}"</h2>

                        <div class="style-stats-grid">
                            <STInputBox :title="$t('%M4')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(getSummaryForType(type).memberships) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('%Gg')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(getSummaryForType(type).members) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('%Gh')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatPrice(getSummaryForType(type).price) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('%7m')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(getSummaryForType(type).organizations) }}
                                    </span>
                                </p>
                            </STInputBox>
                        </div>
                    </div>
                </template>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import OrganizationAvatar from '@stamhoofd/components/context/OrganizationAvatar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useExternalOrganization } from '@stamhoofd/components/groups/hooks/useExternalOrganization.ts';
import { useInterval } from '@stamhoofd/components/hooks/useInterval.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { appToUri, ChargeMembershipsSummary, ChargeMembershipsTypeSummary, PlatformMembershipType } from '@stamhoofd/structures';
import { computed, onActivated, Ref, ref } from 'vue';

const errors = useErrors();
const summary = ref(null) as Ref<null | ChargeMembershipsSummary>;
const context = useContext();
const owner = useRequestOwner();
const platform = usePlatform();
const { patch, patched, addPatch, hasChanges, reset } = usePatch(platform);
const platformManager = usePlatformManager();
const saving = ref(false);
const charging = ref(false);
let loading = false;

const { externalOrganization: membershipOrganization, choose: $chooseMembershipOrganization, loading: loadingOrganization, errorBox: loadingOrganizationErrorBox } = useExternalOrganization(
    computed({
        get: () => patched.value.membershipOrganizationId,
        set: membershipOrganizationId => addPatch({
            membershipOrganizationId,
        }),
    }),
);

useInterval(reload, 10 * 1000);

onActivated(() => {
    reload().catch(console.error);
});

const chooseMembershipOrganization = () => {
    return $chooseMembershipOrganization($t('%9I'));
};

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        await platformManager.value.patch(patch.value, false);
        reset();
        Toast.success($t('%9J')).show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    saving.value = false;
}

async function reload() {
    if (loading) {
        return;
    }

    try {
        loading = true;
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/admin/charge-memberships/summary',
            decoder: ChargeMembershipsSummary as Decoder<ChargeMembershipsSummary>,
            owner,
            shouldRetry: true,
        });
        summary.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading = false;
}

async function charge() {
    if (charging.value) {
        return;
    }
    if (!await CenteredMessage.confirm($t('%9K'), $t('%9L'))) {
        return;
    }

    charging.value = true;
    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/admin/charge-memberships',
            owner,
        });
        Toast.success($t('%9M')).show();
        await reload();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    charging.value = false;
}

function getSummaryForType(type: PlatformMembershipType): ChargeMembershipsTypeSummary {
    if (!summary.value) {
        return ChargeMembershipsTypeSummary.create({});
    }
    return summary.value.membershipsPerType.get(type.id) ?? ChargeMembershipsTypeSummary.create({});
}

</script>

<style lang="scss">
.charge-memberships-view {
    .style-stats-grid {
        padding: 15px 0;
    }

    .style-button-bar {
        padding-top: 15px;
        padding-bottom: 5px;
    }
}
</style>
