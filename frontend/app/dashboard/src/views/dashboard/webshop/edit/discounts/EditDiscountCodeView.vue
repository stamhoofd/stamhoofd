<template>
    <SaveView :title="isNew ? 'Kortingscode toevoegen' : 'Kortingscode bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Kortingscode toevoegen
        </h1>
        <h1 v-else>
            Kortingscode bewerken
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Code" error-fields="code" :error-box="errors.errorBox">
            <input
                v-model="code"
                class="input"
                type="text"
                placeholder="Bv. BLACK-FRIDAY"
                autocomplete="off"
                @blur="cleanCode"
            >
        </STInputBox>
        <p v-if="!code" class="style-description-small">
            Kies zelf een code of <button type="button" class="inline-link" @click="generateCode()">
                genereer één willekeurig
            </button>
        </p>
        <p v-else class="style-description-small">
            De kortingscode kan gebruikt worden via <span v-copyable="'https://'+link" class="style-copyable style-inline-code">{{ link }}</span>
        </p>

        <STInputBox title="Beschrijving" class="max" error-fields="description" :error-box="errors.errorBox">
            <textarea
                v-model="description"
                class="input"
                placeholder="Optioneel"
                autocomplete="off"
            />
        </STInputBox>
        <p class="style-description-small">
            De beschrijving is een interne referentie, en is niet zichtbaar voor bestellers.
        </p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useMaximumUsage" />
                </template>

                <h3 class="style-title-list">
                    Beperk aantal keer te gebruiken (waarvan al {{ patchedDiscountCode.usageCount }} keer gebruikt)
                </h3>

                <div v-if="useMaximumUsage" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="maximumUsage" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>

        <hr>
        <h2>
            Kortingen
        </h2>
        <p>Je kan één of meerdere kortingen verbinden aan een kortingscode.</p>

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
                <span>Korting toevoegen</span>
            </button>
        </p>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze code
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
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
