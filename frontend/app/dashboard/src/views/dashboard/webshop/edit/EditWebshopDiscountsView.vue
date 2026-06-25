<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <hr><h2>{{ $t('%QJ') }}</h2>
        <p>{{ $t('%QK') }}</p>

        <STList v-if="defaultDiscounts.length">
            <STListItem v-for="discount of defaultDiscounts" :key="discount.id" class="right-description right-stack" :selectable="true" @click="editDiscount(discount)">
                <h3 class="style-title-list">
                    {{ getDiscountTitle(discount).title }}
                </h3>
                <p v-if="getDiscountTitle(discount).description" class="style-description-small">
                    {{ getDiscountTitle(discount).description }}
                </p>
                <p v-if="getDiscountTitle(discount).footnote" class="style-description-small pre-wrap" v-text="getDiscountTitle(discount).footnote" />

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add" />
                <span>{{ $t('%QL') }}</span>
            </button>
        </p>

        <hr>

        <h2 class="style-with-button">
            <div>{{ $t('%QM') }}</div>
        </h2>
        <p>{{ $t('%QN') }}</p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="allowDiscountCodeEntry" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%QO') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%QP') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="openDiscountCodes">
                <template #left>
                    <span class="icon label" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Kortingscodes beheren') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Voeg persoonlijke kortingscodes toe, filter de lijst en verstuur ze per e-mail.') }}
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { Discount, PrivateWebshop, WebshopMetaData } from '@stamhoofd/structures';

import { computed } from 'vue';
import type { UseEditWebshopProps } from './useEditWebshop';
import { useEditWebshop } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const present = usePresent();
const show = useShow();
const viewTitle = 'Kortingen';

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
});

const defaultDiscounts = computed(() => webshop.value.meta.defaultDiscounts);

function getDiscountTitle(discount: Discount) {
    return discount.getTitle(webshop.value, true);
}

function addMetaPatch(meta: AutoEncoderPatchType<WebshopMetaData>) {
    const p = PrivateWebshop.patch({ meta });
    addPatch(p);
}

function addDefaultDiscountsPatch(d: PatchableArrayAutoEncoder<Discount>) {
    const meta = WebshopMetaData.patch({ defaultDiscounts: d });
    addMetaPatch(meta);
}

const allowDiscountCodeEntry = computed({
    get: () => webshop.value.meta.allowDiscountCodeEntry,
    set: (value: boolean) => {
        addMetaPatch(WebshopMetaData.patch({ allowDiscountCodeEntry: value }));
    },
});

function addDiscount() {
    const discount = Discount.create({});
    const arr: PatchableArrayAutoEncoder<Discount> = new PatchableArray();
    arr.addPut(discount);

    present({
        components: [
            AsyncComponent(() => import('./discounts/EditDiscountView.vue'), {
                isNew: true,
                discount,
                webshop: webshop.value,
                saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => {
                    arr.merge(patch);
                    addDefaultDiscountsPatch(arr);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function editDiscount(discount: Discount) {
    present({
        components: [
            AsyncComponent(() => import('./discounts/EditDiscountView.vue'), {
                isNew: false,
                discount,
                webshop: webshop.value,
                saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => {
                    addDefaultDiscountsPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function openDiscountCodes() {
    show({
        components: [
            AsyncComponent(() => import('./discounts/WebshopDiscountCodesTableView.vue'), {
                webshop: webshop.value,
            }),
        ],
        adjustHistory: false,
    }).catch(console.error);
}

defineExpose({
    shouldNavigateAway,
});
</script>
