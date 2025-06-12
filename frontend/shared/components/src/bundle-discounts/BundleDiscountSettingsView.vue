<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}

            <span class="title-suffix">
                {{ props.period.period.nameShort }}
            </span>
        </h1>
        <p>{{ $t('9c775d8c-1e2c-40c4-9f61-6be6cb6bd5bb') }}</p>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-model="draggableBundles" :draggable="true">
            <template #item="{item: bundleDiscount}">
                <STListItem :selectable="true" class="right-description right-stack" @click="() => $navigate(Routes.BundleDiscount, { params: { id: bundleDiscount.id } })">
                    <h3 class="style-title-list">
                        {{ bundleDiscount.name || $t('0a0f4ac1-1b0e-48f0-9f21-d1c77ec3f008') }}
                    </h3>
                    <p class="style-description-small">
                        {{ bundleDiscount.humanDescription }}
                    </p>
                    <p class="style-description-small">
                        {{ bundleDiscount.discountsText }}
                    </p>

                    <template #right>
                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="$navigate(Routes.CreateBundleDiscount)">
                <span class="icon add" />
                <span>{{ $t('9a7749d3-dac4-4baa-99e7-8048fe9ff743') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate, usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, usePatch } from '@stamhoofd/components';
import { BundleDiscount, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';
import { ref } from 'vue';

const props = withDefaults(
    defineProps<{
        period: OrganizationRegistrationPeriod;
        saveHandler: (period: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>;
    }>(),
    {
    },
);

const title = $t('98237c41-e107-4997-a645-cc4c16bb5b9a');
const pop = usePop();

const { patched: patchedPeriod, hasChanges, addPatch, patch } = usePatch(props.period);

const draggableBundles = useDraggableArray(() => patchedPeriod.value.settings.bundleDiscounts,
    (patch) => {
        addPatch({
            settings: OrganizationRegistrationPeriodSettings.patch({
                bundleDiscounts: patch,
            }),
        });
    },
);

const errors = useErrors();
const saving = ref(false);
const $navigate = useNavigate();

enum Routes {
    CreateBundleDiscount = 'CreateBundleDiscount',
    BundleDiscount = 'BundleDiscount',
}

defineRoutes([
    {
        name: Routes.CreateBundleDiscount,
        url: 'new',
        component: async () => (await import('./EditBundleDiscountView.vue')).default as any,
        present: 'popup',
        params: {
            id: String,
        },
        paramsToProps: async () => {
            const bundleDiscount = BundleDiscount.create({});
            const settingsPatch = OrganizationRegistrationPeriodSettings.patch({});
            settingsPatch.bundleDiscounts.addPut(bundleDiscount);

            const basePatch = OrganizationRegistrationPeriod.patch({
                settings: settingsPatch,
            });

            return {
                id: bundleDiscount.id,
                isNew: true,
                period: patchedPeriod.value.patch(basePatch),
                saveHandler: (period: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(basePatch.patch(period));
                },
            };
        },
    },
    {
        name: Routes.BundleDiscount,
        url: '@id',
        component: async () => (await import('./EditBundleDiscountView.vue')).default as any,
        present: 'popup',
        params: {
            id: String,
        },
        paramsToProps: async (params: { id: string }) => {
            const bundleDiscount = patchedPeriod.value.settings.bundleDiscounts.find(b => b.id === params.id);
            if (bundleDiscount) {
                return {
                    id: bundleDiscount.id,
                    isNew: false,
                    period: patchedPeriod.value,
                    saveHandler: (period: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                        addPatch(period);
                    },
                };
            }
            Toast.error($t(`1e050d5b-9e14-41ea-9334-9b11a10eedde`)).show();
            throw new Error('Discount not found');
        },

        propsToParams(props) {
            if (!('id' in props) || typeof props.id !== 'string') {
                throw new Error('Missing id');
            }
            return {
                params: {
                    id: props.id,
                },
            };
        },
    },
]);

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        if (await errors.validator.validate()) {
            patch.value.id = props.period.id;
            await props.saveHandler(patch.value);
            await pop({ force: true });
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

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
