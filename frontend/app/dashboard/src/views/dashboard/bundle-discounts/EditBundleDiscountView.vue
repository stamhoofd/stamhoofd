<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>
        <p>{{ $t('Een bundelkorting maak je aan en koppel je vervolgens aan één of meerdere activiteiten of inschrijvingsgroepen waarop die korting geldt. Afhankelijk van de ingestelde toepassingsregels krijgen leden dan korting voor de tweede, derde, vierde... inschrijving bij die ingestelde activiteiten of inschrijvinsgroepen.') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <TInput v-model="name" :placeholder="$t(`bv. Kampkorting broers en zussen`)" error-fields="name" :error-box="errors.errorBox" :title="$t(`Naam`)" />
                <p class="style-description-small">
                    {{ $t('Geef de bundelkorting een duidelijke en korte naam. Deze naam zal zichtbaar zijn voor leden.') }}
                </p>
            </div>
        </div>

        <hr>
        <h2>Toepassingsregels</h2>

        <STInputBox :title="$t('Geldt de korting ook voor gezinsleden?')" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countWholeFamily" :value="false" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Nee, alleen per invividueel lid') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Korting geldt alleen bij meerdere inschrijvingen van hetzelfde lid.') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Bijvoorbeeld: een lid krijgt korting als het zich inschrijft voor meerdere activiteiten of inschrijvingsgroepen.') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countWholeFamily" :value="true" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Ja, ook voor gezinsleden') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Korting geldt ook als gezinsleden zich inschrijven.') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Bijvoorbeeld: een broer of zus krijgt korting als een ander gezinslid al is ingeschreven.') }}
                    </p>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox v-if="countWholeFamily" :title="$t('Mag de korting gelden over verschillende activiteiten heen?')" class="max">
            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countPerGroup" :value="false" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Ja, over alle gekoppelde activiteiten en inschrijvingsgroepen') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Het aantal inschrijvingen voor alle gekoppelde activiteiten wordt samengeteld om de tweede, derde... inschrijving te bepalen') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Bijvoorbeeld: een lid krijgt korting op activiteit B als hetzelf of een familielid voor activiteit A, B, C... is ingeschreven') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="countPerGroup" :value="true" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Nee, alleen binnen dezelfde activiteit of inschrijvingsgroep') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Korting geldt alleen bij meerdere inschrijvingen voor dezelfde activiteit.') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Bijvoorbeeld: een broer krijgt alleen korting op activiteit A als zijn zus ook op activiteit A is ingeschreven.') }}
                    </p>
                </STListItem>
            </STList>
        </STInputBox>

        <hr>
        <h2>Standaard korting</h2>
        <p>Je kan hiervan afwijken door dit aan te passen bij de instellingen van de leeftijdsgroep of activiteit. De grootst mogelijke korting wordt steeds berekend.</p>

        <GroupPriceDiscountsInput v-model="discounts" />

        <hr>
        <h2>Activiteiten en inschrijvingsgroepen</h2>
        <p>
            {{ $t('Kies de activiteiten en inschrijvingsgroepen waarvoor deze bundelkorting geldt. Je kan dit later ook nog koppelen bij de instellingen van de leeftijdsgroep of activiteit.') }}
        </p>

        <p>todo</p>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, GroupPriceDiscountsInput, useErrors, usePatch, useValidation } from '@stamhoofd/components';
import { BundleDiscount, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

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

const title = $t('Bundelkorting');
const deleting = ref(false);
const pop = usePop();
const errors = useErrors();
const saving = ref(false);

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
            message: $t('Geef je bundelkorting een naam'),
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

    if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze bundelkorting wilt verwijderen?'), $t('838cae8b-92a5-43d2-82ba-01b8e830054b'))) {
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
