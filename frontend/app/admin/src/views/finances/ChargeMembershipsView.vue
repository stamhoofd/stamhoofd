<template>
    <LoadingViewTransition :error-box="loadingOrganizationErrorBox">
        <div v-if="!loadingOrganization" class="st-view charge-memberships-view">
            <STNavigationBar :title="$t(`3024d542-4987-4487-ae83-6593036a7e1d`)" />

            <main class="center">
                <h1>
                    {{ $t('fb8c1c30-2108-4a1b-a412-0381263e860e') }}
                </h1>

                <STErrorsDefault :error-box="errors.errorBox" />

                <p v-if="summary && summary.running" class="info-box icon clock">
                    {{ $t('65835e04-2a3a-45cb-ab98-31aac58c882b') }}
                </p>
                <template v-else>
                    <template v-if="membershipOrganization">
                        <hr><h2>{{ $t('5d5cb596-1b5b-4ec3-98dd-2c0f012d9093') }} {{ membershipOrganization.name }}</h2>

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
                                    {{ $t('9ac518c6-00fc-47c1-bd01-2f1f6fa17613') }}
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
                        {{ $t('f3d64c72-9a4e-4de2-8329-39e387fbc933') }}
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
                                {{ $t('fb8224d8-e010-4632-9d50-91cb42a35215') }}
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
                                    {{ $t('6c9746ca-285b-444a-89d3-4052897e2dc2') }}
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
                                {{ $t('5d9d5777-5ecb-4223-8dc2-973ee3fee4bb') }}
                            </button>
                        </LoadingButton>
                    </p>

                    <div v-if="summary && summary?.trials.members > 0" class="container">
                        <hr><h2>{{ $t('cc3d3da6-27ce-4f32-a696-4e08d649a7bc') }}</h2>

                        <div class="style-stats-grid">
                            <STInputBox :title="$t('faa31f24-a42f-454b-9ceb-417c46dcee0d')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(summary.trials.memberships) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('8e0924af-042c-42ab-85e1-dda0a2106b98')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(summary.trials.members) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('e886fb7a-9312-4e74-b426-5acb694fe009')">
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
                        <hr><h2>{{ $t('ed995f5d-eeff-44ad-ac35-f518b2892524') }} "{{ type.name }}"</h2>

                        <div class="style-stats-grid">
                            <STInputBox :title="$t('faa31f24-a42f-454b-9ceb-417c46dcee0d')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(getSummaryForType(type).memberships) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('8e0924af-042c-42ab-85e1-dda0a2106b98')">
                                <p class="style-price-big">
                                    <span v-if="!summary" class="style-placeholder-skeleton" />
                                    <span v-else>
                                        {{ formatInteger(getSummaryForType(type).members) }}
                                    </span>
                                </p>
                            </STInputBox>

                            <STInputBox :title="$t('e886fb7a-9312-4e74-b426-5acb694fe009')">
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
