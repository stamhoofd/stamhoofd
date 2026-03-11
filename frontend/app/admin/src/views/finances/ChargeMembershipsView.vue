<template>
    <LoadingViewTransition :error-box="loadingOrganizationErrorBox">
        <div v-if="!loadingOrganization" class="st-view charge-memberships-view">
            <STNavigationBar :title="$t(`3024d542-4987-4487-ae83-6593036a7e1d`)" />

            <main class="center">
                <h1>
                    {{ $t('bc00376e-db0e-4ace-aecc-9bfc05ee573e') }}
                </h1>

                <STErrorsDefault :error-box="errors.errorBox" />

                <p v-if="summary && summary.running" class="info-box icon clock">
                    {{ $t('65835e04-2a3a-45cb-ab98-31aac58c882b') }}
                </p>
                <template v-else>
                    <template v-if="membershipOrganization">
                        <hr><h2>{{ $t('0fc72e2d-5fe5-4ed2-ba5d-1f880790c174') }} {{ membershipOrganization.name }}</h2>

                        <STList class="illustration-list">
                            <STListItem :selectable="true" class="left-center" element-name="a" :href="'/' + appToUri('dashboard') + '/' + membershipOrganization.uri + '/boekhouding/exporteren'">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/calculator.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('77e1bb0a-166c-4d37-9dd6-c5ad10a9d91b') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t("64633f7b-2d6e-4ad2-abb1-e9dd77d9a81f") }}
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
                                    {{ $t('35f1db1d-e8bd-4a0c-8141-97b8c716ec17') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('143d3f17-d547-47ff-9b83-f8587bcbc16c') }}
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
                                    {{ $t('2e0554e5-f223-4618-942e-53ec88f26e19') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('67433a1e-efe1-48a1-9b4c-84dea499c5b9') }}
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
                                    {{ $t('231f28d7-292a-43bc-877b-751012b6ae48') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('f1248bd5-36f4-40fd-9467-08bda59127d6', {name: membershipOrganization!.name}) }}
                                </p>
                                <template #right>
                                    <span class="icon external gray" />
                                </template>
                            </STListItem>
                        </STList>
                    </template>
                    <hr><h2>
                        {{ $t('3024d542-4987-4487-ae83-6593036a7e1d') }}
                    </h2>
                    <p>
                        {{ $t("4a2a630f-3396-404f-9316-d660df9935a9") }}
                    </p>

                    <div class="style-stats-grid">
                        <STInputBox :title="$t(`44b42e50-8012-4bd7-b4a5-44a80acc61dc`)">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatInteger(summary.memberships) }}
                                </span>
                            </p>
                        </STInputBox>

                        <STInputBox :title="$t(`082fff79-1ecd-450b-a2ed-a5cef7769f0f`)">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatInteger(summary.members) }}
                                </span>
                            </p>
                        </STInputBox>

                        <STInputBox :title="$t(`da735211-2f9d-45bf-a688-d76aaf796cc4`)">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatPrice(summary.price) }}
                                </span>
                            </p>
                        </STInputBox>

                        <STInputBox :title="$t(`f18328bd-8ede-47ca-b38a-85fc0890eccf`)">
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
                                {{ $t('00bdd5bd-af3f-4f83-abe0-696d5b872ca9') }}
                            </button>
                        </LoadingButton>
                    </p>
                    <p class="style-description-small">
                        {{ $t('ffd221f8-0f55-4b66-99f4-d43916f55f90') }}
                    </p>

                    <hr><h2>
                        {{ $t('5e9e86f7-81f6-4ffe-9cda-95982de2b4cb') }}
                    </h2>
                    <p>
                        {{ $t('f1931dcf-219f-4ca2-935b-d5a6747ddbdb') }}
                    </p>

                    <p v-if="membershipOrganization" class="info-box">
                        {{ $t('550e876b-f397-44a5-9e0a-fb5ce6df3a40') }}
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
                                    {{ $t('3b95fc70-7928-426b-b65b-3389d9e762cc') }}
                                    <span class="icon arrow-right-small" />
                                </span>
                            </template>
                        </STListItem>
                    </STList>
                    <p v-else class="warning-box with-button selectable" @click="chooseMembershipOrganization">
                        {{ $t('f4c0da5a-03a8-4be2-9ae1-ea049b5b46af') }}

                        <button class="button text" type="button">
                            {{ $t('1310f065-caf5-41e6-a3b8-cf9b39336483') }}
                        </button>
                    </p>

                    <p v-if="hasChanges" class="style-button-bar">
                        <LoadingButton :loading="saving">
                            <button class="button primary" type="button" @click="save">
                                {{ $t('14abcd1e-7e65-4e84-be4c-ab2e162ae44d') }}
                            </button>
                        </LoadingButton>
                    </p>

                    <div v-if="summary && summary?.trials.members > 0" class="container">
                        <hr><h2>{{ $t('8265d9e0-32c1-453c-ab2f-d31f1eb244c3') }}</h2>

                        <div class="style-stats-grid">
                            <STInputBox :title="$t('697df3e7-fbbf-421d-81c2-9c904dce4842')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(summary.trials.memberships) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('082fff79-1ecd-450b-a2ed-a5cef7769f0f')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(summary.trials.members) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('da735211-2f9d-45bf-a688-d76aaf796cc4')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatPrice(summary.trials.price) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('b789017f-58d2-438b-b73a-2a4d075e3c5b')">
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
                        <hr><h2>{{ $t('151006be-86c2-48cd-bcd7-7c3bf9b76080') }} "{{ type.name }}"</h2>

                        <div class="style-stats-grid">
                            <STInputBox :title="$t('697df3e7-fbbf-421d-81c2-9c904dce4842')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(getSummaryForType(type).memberships) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('082fff79-1ecd-450b-a2ed-a5cef7769f0f')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(getSummaryForType(type).members) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('da735211-2f9d-45bf-a688-d76aaf796cc4')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatPrice(getSummaryForType(type).price) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('b789017f-58d2-438b-b73a-2a4d075e3c5b')">
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
import { CenteredMessage, ErrorBox, LoadingViewTransition, OrganizationAvatar, Toast, useContext, useErrors, useExternalOrganization, useInterval, usePatch, usePlatform } from '@stamhoofd/components';
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
    return $chooseMembershipOrganization($t('78f9f25f-e02d-4310-af9e-87b075aa1232'));
};

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        await platformManager.value.patch(patch.value, false);
        reset();
        Toast.success($t('85dd1619-e565-4bd7-b711-58e864d423c7')).show();
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
    if (!await CenteredMessage.confirm($t('17cffcca-0926-49ae-98a1-123e3459cd20'), $t('03d73550-8d06-475c-815b-f893ae033b03'))) {
        return;
    }

    charging.value = true;
    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/admin/charge-memberships',
            owner,
        });
        Toast.success($t('14f323d7-aec9-42c7-9cb0-3c2769770f02')).show();
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
