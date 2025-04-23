<template>
    <SaveView :title="isNew ? $t(`Kortingscode toevoegen`) : $t(`Kortingscode bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('ccdda763-4c52-4a25-94ed-458b601be3a4') }}
        </h1>
        <h1 v-else>
            {{ $t('2c80a707-f641-49ac-a05c-55962b4c9660') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="code" :error-box="errors.errorBox" :title="$t(`55a6f957-af81-40b3-8c83-2096f22044c8`)">
            <input v-model="code" class="input" type="text" autocomplete="off" :placeholder="$t(`93258b4f-4bbd-40bb-a0d4-7e1112f7aeaf`)" @blur="cleanCode">
        </STInputBox>
        <p v-if="!code" class="style-description-small">
            {{ $t('fe53474b-5d28-4a53-8478-0d32bc415102') }} <button type="button" class="inline-link" @click="generateCode()">
                {{ $t('88f0ad0c-254c-4496-829a-92c2ef9d7272') }}
            </button>
        </p>
        <p v-else class="style-description-small">
            {{ $t('072a6888-a4a5-452a-9544-7e376db90540') }} <span v-copyable="'https://'+link" class="style-copyable style-inline-code">{{ link }}</span>
        </p>

        <STInputBox class="max" error-fields="description" :error-box="errors.errorBox" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <textarea v-model="description" class="input" autocomplete="off" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('9d9a920b-4ab2-4ba2-9c17-58dc2d7fff2b') }}
        </p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useMaximumUsage" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('f884e374-a539-4c27-ad5f-18b890e97141', {count: patchedDiscountCode.usageCount.toString()}) }}
                </h3>

                <div v-if="useMaximumUsage" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="maximumUsage" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>

        <hr><h2>
            {{ $t('2173a56e-ee80-4e8d-9551-20f061fff7b9') }}
        </h2>
        <p>{{ $t('3995a793-8451-4e7e-a74d-9a66d8114d9c') }}</p>

        <STList v-if="patchedDiscountCode.discounts.length">
            <STListItem v-for="discount of patchedDiscountCode.discounts" :key="discount.id" class="right-description right-stack" :selectable="true" @click="editDiscount(discount)">
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
                <span>{{ $t('46681ff6-bc40-4da6-9c3f-f8f335d72633') }}</span>
            </button>
        </p>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('ca70e639-c7f8-40d7-9054-9c01711d3f5b') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, ErrorBox, NumberInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { Discount, DiscountCode, PrivateWebshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { computed } from 'vue';
import EditDiscountView from './EditDiscountView.vue';

const props = defineProps<{
    discountCode: DiscountCode;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => void;
}>();

const errors = useErrors();
const organization = useOrganization();
const present = usePresent();
const pop = usePop();

/// For now only used to update locations and times of other products that are shared
const { patch: patchDiscountCode, patched: patchedDiscountCode, addPatch, hasChanges } = usePatch(props.discountCode);

const link = computed(() => {
    const cleaned = Formatter.slug(code.value).toUpperCase();
    return props.webshop.getUrl(organization.value!) + '/code/' + cleaned;
});

function getDiscountTitle(discount: Discount) {
    return discount.getTitle(props.webshop, true);
}

const code = computed({
    get: () => patchedDiscountCode.value.code,
    set: (code: string) => {
        addPatch(DiscountCode.patch({
            code,
        }));
    },
});

const description = computed({
    get: () => patchedDiscountCode.value.description,
    set: (description: string) => {
        addPatch(DiscountCode.patch({
            description,
        }));
    },
});

const maximumUsage = computed({
    get: () => patchedDiscountCode.value.maximumUsage,
    set: (maximumUsage: number | null) => {
        addPatch(DiscountCode.patch({
            maximumUsage,
        }));
    },
});

const useMaximumUsage = computed({
    get: () => maximumUsage.value !== null,
    set: (useMaximumUsage: boolean) => {
        if (useMaximumUsage) {
            maximumUsage.value = maximumUsage.value ?? props.discountCode.maximumUsage ?? 1;
        }
        else {
            maximumUsage.value = null;
        }
    },
});

function addDiscountsPatch(d: PatchableArrayAutoEncoder<Discount>) {
    const meta = DiscountCode.patch({
        discounts: d,
    });
    addPatch(meta);
}

function addDiscount() {
    const discount = Discount.create({});
    const arr: PatchableArrayAutoEncoder<Discount> = new PatchableArray();
    arr.addPut(discount);

    present({
        components: [
            new ComponentWithProperties(EditDiscountView, {
                isNew: true,
                discount,
                webshop: props.webshop,
                saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => {
                    arr.merge(patch);
                    addDiscountsPatch(arr);
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
                webshop: props.webshop,
                saveHandler: (patch: PatchableArrayAutoEncoder<Discount>) => {
                    addDiscountsPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function cleanCode() {
    code.value = Formatter.slug(code.value).toUpperCase();
}

function validate() {
    if (code.value.length === 0) {
        throw new SimpleError({
            code: 'required_field',
            field: 'code',
            message: 'Vul een code in',
        });
    }

    if (patchedDiscountCode.value.discounts.length === 0) {
        throw new SimpleError({
            code: 'required_field',
            field: 'discounts',
            message: 'Voeg minstens één korting toe',
        });
    }
}

async function save() {
    cleanCode();

    const isValid = await errors.validator.validate();
    errors.errorBox = null;

    try {
        validate();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        return;
    }

    if (!isValid) {
        return;
    }
    const p: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
    p.addPatch(patchDiscountCode.value);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze kortingscode wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
    p.addDelete(props.discountCode.id);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

function generateCode() {
    function nextChar() {
        // All characters except difficult to differentiate characters in uppercase (0, O, 1, L, I)
        const allowList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '2', '3', '4', '5', '6', '7', '8', '9'];
        return allowList[Math.floor(Math.random() * allowList.length)];
    }

    function nextChars(num = 4) {
        let result = '';
        for (let i = 0; i < num; i++) {
            result += nextChar();
        }
        return result;
    }

    code.value = nextChars(4) + '-' + nextChars(4) + '-' + nextChars(4) + '-' + nextChars(4);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script>
