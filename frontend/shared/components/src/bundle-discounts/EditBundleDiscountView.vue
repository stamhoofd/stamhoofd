<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" @save="save" v-on="!isNew ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>
        <p>{{ $t('Een bundelkorting maak je aan en koppel je vervolgens aan één of meerdere activiteiten of inschrijvingsgroepen waarop die korting geldt. Afhankelijk van de ingestelde toepassingsregels krijgen leden dan korting voor de tweede, derde, vierde... inschrijving bij die ingestelde activiteiten of inschrijvinsgroepen.') }}</p>

        <p class="warning-box">
            {{ $t('Opgelet, als je een korting wijzigt of toevoegt heeft dit ook gevolgen voor bestaande inschrijvingen die deze korting al hadden gekregen / niet hadden gekregen. Test je kortingen goed uit en lees de documentatie grondig.') }}
        </p>

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
        <h2>{{ $t('Standaard korting') }}</h2>
        <p>{{ $t('Je kan hiervan afwijken door dit aan te passen bij de instellingen van de leeftijdsgroep of activiteit. De grootst mogelijke korting wordt steeds berekend.') }}</p>

        <GroupPriceDiscountsInput v-model="discounts" />

        <hr>
        <h2>{{ $t('Activiteiten en inschrijvingsgroepen') }}</h2>
        <p>
            {{ $t('Hieronder vindt je een overzicht van alle activiteiten en inschrijvingsgroepen waarvoor deze bundelkorting is ingesteld. Je kan dit aanpassen bij de instellingen van de leeftijdsgroep of activiteit.') }}
        </p>

        <LoadingBoxTransition :error-box="errors.errorBox">
            <div v-if="patchedGroups !== null && patchedGroups.length === 0" class="info-box">
                {{ $t('Er zijn geen groepen die aan deze bundelkorting gekoppeld zijn. Je kan activiteiten en groepen koppelen via de instellingen van elke activiteit of groep.') }}
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

const title = $t('Bundelkorting');
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
            return $t('Aangepaste kortingen') + '\n' + BundleDiscount.discountsToText(customDiscounts);
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
            return $t('Met aangepaste kortingen:') + '\n' + hasCustom.map(p => `${p.name}: ${BundleDiscount.discountsToText(p.customDiscounts!)}`).join('\n');
        }
        // default prices
        return;
    }

    if (applicablePrices.length === 1) {
        return $t('Enkel op tarief {priceName}', {
            priceName: applicablePrices[0].name,
        });
    }
    return $t('Enkel voor tarieven:') + applicablePrices.map(p => p.name).join(', ');
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
