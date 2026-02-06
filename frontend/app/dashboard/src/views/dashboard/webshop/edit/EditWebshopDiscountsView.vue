<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <hr><h2>{{ $t('9bbdb9e4-fc41-4135-8ad1-f55f61a7aa63') }}</h2>
        <p>{{ $t('180981ba-a251-4d5f-bcfa-6256b238b5c5') }}</p>

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
                <span>{{ $t('6a35dc73-d0b6-4785-acb8-0a49460abbf0') }}</span>
            </button>
        </p>

        <hr><h2>{{ $t('8b322fca-7359-434a-9813-0ab2565cc2a6') }}</h2>
        <p>{{ $t('29f1eed1-3fc5-4714-98f4-4c71d63d0d65') }}</p>

        <Spinner v-if="fetchingDiscountCodes" />
        <div v-else>
            <STList v-if="patchedDiscountCodes.length || allowDiscountCodeEntry">
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="allowDiscountCodeEntry" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('7bae6892-1011-4c14-8708-2d7d016831e1') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('7e21be30-cf02-497c-9157-2fea6aefc26f') }}
                    </p>
                </STListItem>

                <STListItem v-for="discountCode of patchedDiscountCodes" :key="discountCode.id" class="right-description right-stack left-center" :selectable="true" @click="editDiscountCode(discountCode)">
                    <template #left>
                        <span class="icon label" />
                    </template>

                    <h3 class="style-title-list">
                        <span class="style-discount-code">{{ discountCode.code }}</span>
                    </h3>
                    <p v-if="discountCode.description" class="style-description-small">
                        {{ discountCode.description }}
                    </p>
                    <p class="style-description-small">
                        {{ discountCode.usageCount }} {{ $t('cf404a1c-892b-42f5-b0e6-9dc88f0917fa') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                {{ $t('1ec72626-a767-4f6d-b864-64443633ec98') }}
            </p>
        </div>

        <p>
            <button class="button text" type="button" @click="addDiscountCode">
                <span class="icon add" />
                <span>{{ $t('46a3962f-7d21-4cf4-b3a9-bfec8007e68a') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Checkbox, SaveView, Spinner, STErrorsDefault, STList, STListItem, Toast, useContext, usePatchArray } from '@stamhoofd/components';
import { Discount, DiscountCode, PrivateWebshop, WebshopMetaData } from '@stamhoofd/structures';
import EditDiscountCodeView from './discounts/EditDiscountCodeView.vue';
import EditDiscountView from './discounts/EditDiscountView.vue';

import { computed, nextTick, onMounted, ref } from 'vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const present = usePresent();
const viewTitle = 'Kortingen';

const { webshop, addPatch, errors, saving, save, hasChanges: hasWebshopChanges, shouldNavigateAway } = useEditWebshop({
    afterSave,
    validate: () => {},
    getProps: () => props,
});

const context = useContext();
const fetchingDiscountCodes = ref(false);
const discountCodes = ref<DiscountCode[]>([]);

const { patch: patchDiscountCodes, patched: patchedDiscountCodes, hasChanges: hasDiscountCodeChanges, addArrayPatch: addDiscountCodesPatch } = usePatchArray<DiscountCode>(discountCodes);
const hasChanges = computed(() => hasWebshopChanges.value || hasDiscountCodeChanges.value);

onMounted(() => {
    fetchDiscountCodes().catch(console.error);
});

async function fetchDiscountCodes() {
    fetchingDiscountCodes.value = true;
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/webshop/${webshop.value.id}/discount-codes`,
            decoder: new ArrayDecoder(DiscountCode as Decoder<DiscountCode>),
        });
        discountCodes.value = response.data;
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    fetchingDiscountCodes.value = false;
}

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
            new ComponentWithProperties(EditDiscountView, {
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
            new ComponentWithProperties(EditDiscountView, {
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

function addDiscountCode() {
    const discountCode = DiscountCode.create({
        code: '',
    });
    const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
    arr.addPut(discountCode);

    present({
        components: [
            new ComponentWithProperties(EditDiscountCodeView, {
                isNew: true,
                discountCode,
                webshop: webshop.value,
                saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                    arr.merge(patch);
                    // todo: test
                    addDiscountCodesPatch(arr);

                    nextTick(() => {
                        if (patchedDiscountCodes.value.length === 1) {
                            allowDiscountCodeEntry.value = true;
                        }
                    }).catch(console.error);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function editDiscountCode(discountCode: DiscountCode) {
    present({
        components: [
            new ComponentWithProperties(EditDiscountCodeView, {
                isNew: false,
                discountCode,
                webshop: webshop.value,
                saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                    // todo: test
                    addDiscountCodesPatch(patch);

                    nextTick(() => {
                        if (patchedDiscountCodes.value.length === 0) {
                            allowDiscountCodeEntry.value = false;
                        }
                    }).catch(console.error);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

async function afterSave() {
    if (patchDiscountCodes.value.changes.length === 0) {
        return;
    }

    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: `/webshop/${webshop.value.id}/discount-codes`,
        body: patchDiscountCodes.value,
        decoder: new ArrayDecoder(DiscountCode as Decoder<DiscountCode>),
    });

    patchDiscountCodes.value = new PatchableArray();
    for (const d of response.data) {
        const existing = discountCodes.value.find(dd => dd.id === d.id);
        if (existing) {
            existing.deepSet(d);
        }
        else {
            discountCodes.value.push(d);
        }
    }
}

defineExpose({
    shouldNavigateAway,
});
</script>
