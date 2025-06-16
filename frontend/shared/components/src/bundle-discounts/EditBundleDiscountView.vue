<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>
        <p>{{ $t('ca70876e-5a32-40fe-9224-6e61ed055df6') }}</p>

        <p class="warning-box">
            {{ $t('2b00749a-bd88-4140-a074-79bf08d359fe') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <TInput v-model="name" :placeholder="$t(`0f3a6e76-b5f2-4f92-b4e4-d709dffc1bde`)" error-fields="name" :error-box="errors.errorBox" :title="$t(`8822547e-03a0-4e70-bdce-9661a6c6f613`)" />
                <p class="style-description-small">
                    {{ $t('c1ed9e16-70d4-4337-a4e1-ecf31ec00bed') }}
                </p>
            </div>
        </div>

        <hr>
        <h2>{{ $t('f9015fbd-7b3f-450b-b54a-25f017bb8d86') }}</h2>

        <STInputBox :title="$t('59a2cb2c-8935-42df-afab-6c5995e2cea3')" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countWholeFamily" :value="false" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('1337c2d7-aec6-4ca9-be43-b211421b772a') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('09389428-111c-453b-8ed9-884e4b26fcb3') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('cafe0f16-604c-436e-b12e-ef6b0e9d2387') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countWholeFamily" :value="true" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('7bf36754-abf8-40f0-a7f0-70439bbbecac') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('02a33069-e9a3-4477-a55b-e05a627976f1') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('2509e2f2-111f-4eb5-8612-487dd62950a2') }}
                    </p>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox v-if="countWholeFamily" :title="$t('6a21c1ba-b3fb-4a6f-983f-7f407a2a3f66')" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countPerGroup" :value="false" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('3ce43f2c-d59c-4cb7-8957-3508770fd5a8') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('b9b2c925-1396-4536-b883-6f7d82acfcb1') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('a7ec27e7-ec66-41da-ae2d-ea67fe8a088d') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countPerGroup" :value="true" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('ea9dfea3-7c81-4b90-9d1a-aee6a9e34aea') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('374ffe63-707c-4e33-958b-30c91db2a527') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('fef46e6b-6dd7-406b-947e-8317a6736d68') }}
                    </p>
                </STListItem>
            </STList>
        </STInputBox>

        <hr>
        <h2>{{ $t('e3e20081-5971-478e-a69b-09b61fb858da') }}</h2>
        <p>{{ $t('09087d69-6c29-447e-8d6c-0b1aac491afc') }}</p>

        <GroupPriceDiscountsInput v-model="discounts" />

        <hr>
        <h2>{{ $t('98666406-d3e9-4c35-a1c8-d6dc80949866') }}</h2>
        <p>
            {{ $t('1eb85876-5ca5-4388-9a1a-bfece589bdcf') }}
        </p>

        <LoadingBoxTransition :error-box="errors.errorBox">
            <div v-if="patchedGroups !== null && patchedGroups.length === 0" class="info-box">
                {{ $t('d64c7018-f8f5-4532-88b4-a1a29490a49c') }}
            </div>
            <STList v-if="patchedGroups !== null">
                <STListItem v-for="group of patchedGroups" :key="group.id" class="container" :selectable="true" @click="editGroup(group)">
                    <template #left>
                        <GroupAvatar :group="group" />
                    </template>

                    <h3 class="style-title-list">
                        {{ group.settings.name }}
                    </h3>

                    <p v-if="getDescriptionForGroup(group)" class="style-description-small pre-wrap">
                        {{ getDescriptionForGroup(group) }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </LoadingBoxTransition>
    </SaveView>
</template>

<script setup lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { GroupAvatar, LoadingBoxTransition, CenteredMessage, ErrorBox, GroupPriceDiscountsInput, useErrors, usePatch, useValidation, useContext, EditGroupView } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { BundleDiscount, Group, LimitedFilteredRequest, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, PaginatedResponseDecoder, SortItemDirection } from '@stamhoofd/structures';
import { computed, Ref, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        id: string;
        isNew?: boolean;
        period: OrganizationRegistrationPeriod;
        saveHandler: (period: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>;
    }>(),
    {
        isNew: false,
    },
);

const title = $t('472a987d-498d-46b0-b925-3963f729492b');
const deleting = ref(false);
const pop = usePop();
const errors = useErrors();
const saving = ref(false);
const groups = ref(null) as Ref<null | Group[]>;
const context = useContext();
const owner = useRequestOwner();
const present = usePresent();

loadGroups().catch(console.error);

const { patched: patchedPeriod, hasChanges, addPatch: addPeriodPatch, patch } = usePatch(props.period);
const bundleDiscount = computed(() => patchedPeriod.value.settings.bundleDiscounts.find(b => b.id === props.id)!);
const countWholeFamily = computed({
    get: () => bundleDiscount.value.countWholeFamily,
    set: (countWholeFamily) => {
        addPatch(
            BundleDiscount.patch({
                countWholeFamily,
            }),
        );
    },
});

const countPerGroup = computed({
    get: () => bundleDiscount.value.countPerGroup,
    set: (countPerGroup) => {
        addPatch(
            BundleDiscount.patch({
                countPerGroup,
            }),
        );
    },
});

function addPatch(patch: AutoEncoderPatchType<BundleDiscount>) {
    patch.id = props.id;
    const p = OrganizationRegistrationPeriodSettings.patch({});
    p.bundleDiscounts.addPatch(patch);

    addPeriodPatch({
        settings: p,
    });
}

const name = computed({
    get: () => bundleDiscount.value.name,
    set: (name) => {
        addPatch(
            BundleDiscount.patch({
                name,
            }),
        );
    },
});

useValidation(errors.validator, () => {
    if (name.value.length === 0) {
        throw new SimpleError({
            code: 'invalid_field',
            message: $t('c6be4ce9-199f-43cc-9c64-1b2ec1c83b80'),
            field: 'name',
        });
    }
});

const discounts = computed({
    get: () => bundleDiscount.value.discounts,
    set: (discounts) => {
        addPatch(
            BundleDiscount.patch({
                discounts,
            }),
        );
    },
});

async function loadGroups() {
    if (props.isNew) {
        groups.value = [];
        return;
    }

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/groups',
            query: new LimitedFilteredRequest({
                filter: {
                    periodId: props.period.period.id,
                    bundleDiscounts: {
                        [props.id]: {
                            $neq: null,
                        },
                    },
                },
                limit: 100,
            }),
            decoder: new PaginatedResponseDecoder(
                new ArrayDecoder(Group as Decoder<Group>),
                LimitedFilteredRequest,
            ),
            owner,
            shouldRetry: true,
        });
        groups.value = response.data.results;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        return;
    }
}

const patchedGroups = computed(() => {
    const allPatchedGroups = patchedPeriod.value.groups;
    return groups.value?.map((g) => {
        return allPatchedGroups.find(patchedGroup => patchedGroup.id === g.id) ?? g;
    }) ?? null;
});

async function editGroup(group: Group) {
    if (!props.period.groups.find(g => g.id === group.id)) {
        props.period.groups.push(group);
    }

    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                period: patchedPeriod.value,
                groupId: group.id,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPeriodPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function getDescriptionForGroup(group: Group): string | undefined {
    if (group.settings.prices.length === 1) {
        const customDiscounts = group.settings.prices[0].bundleDiscounts.get(props.id)?.customDiscounts;
        if (customDiscounts) {
            return $t('62397a8b-fcf1-404e-afef-d6cc49c577d6') + '\n' + BundleDiscount.discountsToText(customDiscounts);
        }
        return;
    }

    const applicablePrices = group.settings.prices.filter(p => p.bundleDiscounts.has(props.id));
    if (applicablePrices.length === 0) {
        return;
    }
    if (applicablePrices.length === group.settings.prices.length) {
        const hasCustom = group.settings.prices.map(p => ({ name: p.name, customDiscounts: p.bundleDiscounts.get(props.id)?.customDiscounts })).filter(p => !!p.customDiscounts);
        if (hasCustom.length) {
            return $t('d4db6f9b-ede7-4c60-b910-5ca947208d91') + '\n' + hasCustom.map(p => `${p.name}: ${BundleDiscount.discountsToText(p.customDiscounts!)}`).join('\n');
        }
        // default prices
        return;
    }

    if (applicablePrices.length === 1) {
        return $t('2bd72941-dfeb-48a8-872a-16ef0aff1dc6', {
            priceName: applicablePrices[0].name,
        });
    }
    return $t('1363a154-392e-41a2-b18f-938fb72c3ef3') + applicablePrices.map(p => p.name).join(', ');
}

async function save() {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (await errors.validator.validate()) {
            await props.saveHandler(patch.value);
            await pop({ force: true });
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
};

async function doDelete() {
    if (saving.value || deleting.value) {
        return;
    }

    if (!await CenteredMessage.confirm($t('f79934ca-a26c-4728-9a5f-c9cec74d6b90'), $t('838cae8b-92a5-43d2-82ba-01b8e830054b'))) {
        return;
    }

    deleting.value = true;
    try {
        const deletePatch = OrganizationRegistrationPeriodSettings.patch({});
        deletePatch.bundleDiscounts.addDelete(props.id);
        await props.saveHandler(OrganizationRegistrationPeriod.patch({ settings: deletePatch }));
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
