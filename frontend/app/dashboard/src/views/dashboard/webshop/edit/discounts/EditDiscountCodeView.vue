<template>
    <SaveView :title="isNew ? $t(`Kortingscode toevoegen`) : $t(`Kortingscode bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('f56b27d2-c893-43eb-8364-e475cca1c7b5') }}
        </h1>
        <h1 v-else>
            {{ $t('0bd1fdf6-8908-46f4-ba01-ad001803b796') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox error-fields="code" :error-box="errors.errorBox" :title="$t(`1ae2e944-e3b9-4354-bb7a-05e28272c554`)">
            <input v-model="code" class="input" type="text" autocomplete="off" @blur="cleanCode" :placeholder="$t(`f8f07f8d-bca2-4442-b332-134d56ed4b15`)"></STInputBox>
        <p v-if="!code" class="style-description-small">
            {{ $t('d221fa98-5a7f-48b9-b0cd-a9891680bea6') }} <button type="button" class="inline-link" @click="generateCode()">
                {{ $t('584cc7ec-06a2-40ee-8123-6e3689973890') }}
            </button>
        </p>
        <p v-else class="style-description-small">
            {{ $t('5ddc56e5-8e32-4ba9-82ac-a42030ec30c0') }} <span v-copyable="'https://'+link" class="style-copyable style-inline-code">{{ link }}</span>
        </p>

        <STInputBox class="max" error-fields="description" :error-box="errors.errorBox" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
            <textarea v-model="description" class="input" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"/>
        </STInputBox>
        <p class="style-description-small">
            {{ $t('dd0790c6-2447-43e6-8edc-9bea21a2c250') }}
        </p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useMaximumUsage"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('272692c3-6e9d-4e02-a1ef-9ad33f96496d') }} {{ patchedDiscountCode.usageCount }} {{ $t('b46b6e73-532f-4ddc-a576-09e9325cfd99') }}
                </h3>

                <div v-if="useMaximumUsage" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="maximumUsage"/>
                    </STInputBox>
                </div>
            </STListItem>
        </STList>

        <hr><h2>
            {{ $t('47931f38-0599-41aa-bc5c-0d91526017a4') }}
        </h2>
        <p>{{ $t('a3d3a0f4-d97d-4690-9dab-1149f8da0f1e') }}</p>

        <STList v-if="patchedDiscountCode.discounts.length">
            <STListItem v-for="discount of patchedDiscountCode.discounts" :key="discount.id" class="right-description right-stack" :selectable="true" @click="editDiscount(discount)">
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
                <span>{{ $t('80068224-902d-4e6b-9584-be2260b19f18') }}</span>
            </button>
        </p>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('17d869d4-5a16-4404-b548-410e81a161c3') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
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
