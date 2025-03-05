<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <hr><h2>{{ $t('d1f69d4c-ac52-4502-9a6f-ef9f21d7fc44') }}</h2>
        <p>{{ $t('4dc14171-b85b-43a8-a15a-76662f5a702d') }}</p>

        <STList v-if="defaultDiscounts.length">
            <STListItem v-for="discount of defaultDiscounts" :key="discount.id" class="right-description right-stack" :selectable="true" @click="editDiscount(discount)">
                <h3 class="style-title-list">
                    {{ getDiscountTitle(discount).title }}
                </h3>
                <p v-if="getDiscountTitle(discount).description" class="style-description-small">
                    {{ getDiscountTitle(discount).description }}
                </p>
                <p v-if="getDiscountTitle(discount).footnote" class="style-description-small pre-wrap" v-text="getDiscountTitle(discount).footnote"/>

                <template #right>
                    <span class="icon arrow-right-small gray"/>
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addDiscount">
                <span class="icon add"/>
                <span>{{ $t('2ec8a426-50a7-427b-a9a0-f51a16ed4b15') }}</span>
            </button>
        </p>

        <hr><h2>{{ $t('7403615b-24c2-47e7-aa21-9fa3f503677c') }}</h2>
        <p>{{ $t('3ef71130-ad5a-4e17-83a1-687e8b0989d5') }}</p>

        <Spinner v-if="fetchingDiscountCodes"/>
        <div v-else>
            <STList v-if="patchedDiscountCodes.length || allowDiscountCodeEntry">
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="allowDiscountCodeEntry"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('53143c16-e720-4468-9b23-a98073865b67') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('f3dbfc93-ab24-444f-a86c-6bf1c4b99f54') }}
                    </p>
                </STListItem>

                <STListItem v-for="discountCode of patchedDiscountCodes" :key="discountCode.id" class="right-description right-stack left-center" :selectable="true" @click="editDiscountCode(discountCode)">
                    <template #left>
                        <span class="icon label"/>
                    </template>

                    <h3 class="style-title-list">
                        <span class="style-discount-code">{{ discountCode.code }}</span>
                    </h3>
                    <p v-if="discountCode.description" class="style-description-small">
                        {{ discountCode.description }}
                    </p>
                    <p class="style-description-small">
                        {{ discountCode.usageCount }} {{ $t('1096b30a-c8c9-4553-becc-a26a19c78b58') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                {{ $t('8c1cb82c-85f7-41d5-8935-0a7c0be3711f') }}
            </p>
        </div>

        <p>
            <button class="button text" type="button" @click="addDiscountCode">
                <span class="icon add"/>
                <span>{{ $t('2f4e2886-2c75-47d7-8bc4-5ace1a8d3a33') }}</span>
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

const { webshop, addPatch, errors, saving, save, hasChanges: hasWebshopChanges } = useEditWebshop({
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
</script>
