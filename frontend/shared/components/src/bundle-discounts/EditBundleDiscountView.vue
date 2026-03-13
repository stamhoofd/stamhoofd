<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>
        <p>{{ $t('%15z') }}</p>

        <p class="warning-box">
            {{ $t('%160') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <TInput v-model="name" :placeholder="$t(`%16R`)" error-fields="name" :error-box="errors.errorBox" :title="$t(`%Gq`)" />
                <p class="style-description-small">
                    {{ $t('%161') }}
                </p>
            </div>
        </div>

        <hr>
        <h2>{{ $t('%17c') }}</h2>

        <STInputBox :title="$t('%162')" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countWholeFamily" :value="false" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%163') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%164') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%165') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countWholeFamily" :value="true" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%166') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%167') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%168') }}
                    </p>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox v-if="countWholeFamily" :title="$t('%169')" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countPerGroup" :value="false" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%16A') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%16B') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%16C') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countPerGroup" :value="true" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%16D') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%16E') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%16F') }}
                    </p>
                </STListItem>
            </STList>
        </STInputBox>

        <hr>
        <h2>{{ $t('%16G') }}</h2>
        <p>{{ $t('%16H') }}</p>

        <GroupPriceDiscountsInput v-model="discounts" />

        <hr>
        <h2>{{ $t('%16I') }}</h2>
        <p>
            {{ $t('%16J') }}
        </p>

        <LoadingBoxTransition :error-box="errors.errorBox">
            <div v-if="patchedGroups !== null && patchedGroups.length === 0" class="info-box">
                {{ $t('%16K') }}
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
import GroupAvatar from '#GroupAvatar.vue';
import LoadingBoxTransition from '#containers/LoadingBoxTransition.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import GroupPriceDiscountsInput from '#groups/components/GroupPriceDiscountsInput.vue';
import { useErrors } from '#errors/useErrors.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { useValidation } from '#errors/useValidation.ts';
import { useContext } from '#hooks/useContext.ts';
import EditGroupView from '#groups/EditGroupView.vue';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
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

const title = $t('%16L');
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
            message: $t('%16M'),
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
            return $t('%16N') + '\n' + BundleDiscount.discountsToText(customDiscounts);
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
            return $t('%16O') + '\n' + hasCustom.map(p => `${p.name}: ${BundleDiscount.discountsToText(p.customDiscounts!)}`).join('\n');
        }
        // default prices
        return;
    }

    if (applicablePrices.length === 1) {
        return $t('%16S', {
            priceName: applicablePrices[0].name,
        });
    }
    return $t('%16P') + applicablePrices.map(p => p.name).join(', ');
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

    if (!await CenteredMessage.confirm($t('%16Q'), $t('%CJ'))) {
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
