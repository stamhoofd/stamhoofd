<template>
    <SaveView :disabled="!hasChanges" :title="$t(`Zaalplan`)" @save="save">
        <h1>
            {{ $t('Kies een zaalplan') }}
        </h1>
        <p>
            {{ $t('Je kan een zaalplan aanmaken of een bestaand zaalplan kiezen. Je kan in de loop van een evenement wijzigingen maken aan een zaalplan of zelfs een ander zaalplan kiezen op voorwaarde dat dezelfde rij en zetelnummers gebruikt worden.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="selectedPlan" :value="null" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Geen zetelselectie') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Er worden geen plaatsen aan tickets gekoppeld.') }}
                </p>
            </STListItem>

            <STListItem v-for="plan in allSeatingPlans" :key="plan.id" :selectable="true" element-name="label" class="right-stack">
                <template #left>
                    <Radio v-model="selectedPlan" :value="plan.id" />
                </template>

                <h3 class="style-title-list">
                    {{ plan.name }}
                </h3>
                <p v-if="plan.seatCount > 1" class="style-description-small">
                    {{ plan.seatCount }} {{ $t('plaatsen') }}
                </p>

                <p v-if="isFromOtherWebshop(plan)" class="style-description-small">
                    {{ $t('Dit zaalplan is van een andere webshop ({name}). Door het te kiezen wordt een kopie toegevoegd aan deze webshop. Aanpassingen worden niet overgenomen in bestaande webshops.', {name: getWebshopFor(plan)?.meta?.name ?? 'Onbekend'}) }}
                </p>

                <template #right>
                    <button v-if="!isFromOtherWebshop(plan)" class="button icon trash gray" type="button" @click="deleteSeatingPlan(plan.id)" />
                    <button class="button icon edit gray" type="button" @click="editSeatingPlan(plan)" />
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addSeatingPlan">
                <span class="icon add" />
                <span>{{ $t('Zaalplan aanmaken') }}</span>
            </button>
        </p>

        <hr><h2>{{ $t('Acties') }}</h2>

        <STList class="illustration-list">
            <STListItem :selectable="true" class="left-center" element-name="label">
                <input type="file" multiple style="display: none;" accept=".plan" @change="importSeatingPlan"><template #left>
                    <img src="@stamhoofd/assets/images/illustrations/box-upload.svg">
                </template>

                <h2 class="style-title-list">
                    {{ $t('Importeer zaalplan') }}
                </h2>
                <p class="style-description">
                    {{ $t('5c7d8f29-9d83-4f33-9d6b-0f947e384f75') }}
                </p>

                <template #right>
                    <LoadingButton :loading="importingSeatingPlan">
                        <span class="icon download gray" />
                    </LoadingButton>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, Decoder, ObjectData, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, LoadingButton, Radio, SaveView, STErrorsDefault, STList, STListItem, Toast, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { PrivateWebshop, Product, SeatingPlan, SeatingPlanCategory, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, SeatType, WebshopMetaData } from '@stamhoofd/structures';
import { sleep, Sorter } from '@stamhoofd/utility';

import { useTranslate } from '@stamhoofd/frontend-i18n';
import { computed, ref } from 'vue';
import EditSeatingPlanView from './EditSeatingPlanView.vue';

const props = defineProps<{
    product: Product;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patchProduct: AutoEncoderPatchType<Product>, patch: AutoEncoderPatchType<PrivateWebshop>) => void;
}>();

const errors = useErrors();
const organization = useOrganization();
const pop = usePop();
const present = usePresent();
const $t = useTranslate();

const importingSeatingPlan = ref(false);

const { patch: patchWebshop, patched: patchedWebshop, addPatch: addWebshopPatch, hasChanges: hasWebshopChanges } = usePatch(props.webshop);
const { patch: patchProduct, patched: patchedProduct, addPatch, hasChanges: hasProductChanges } = usePatch(props.product);
const hasChanges = computed(() => hasWebshopChanges.value || hasProductChanges.value);

function isFromOtherWebshop(seatingPlan: SeatingPlan) {
    return !patchedWebshop.value.meta.seatingPlans.find(p => p.id === seatingPlan.id);
}

function getWebshopFor(seatingPlan: SeatingPlan) {
    return organization.value?.webshops.find(w => w.meta.seatingPlans.find(p => p.id == seatingPlan.id));
}

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }

    // If seating plan is not yet added to webshop, add it.
    const added = addSeatingPlanIfNotInWebshop(selectedPlan.value);
    if (added) {
        // We assigned a new id to this seating plan
        const { webshopPatch, id } = added;
        addPatch(Product.patch({ seatingPlanId: id }));
        addWebshopPatch(webshopPatch);
    }

    props.saveHandler(patchProduct.value, patchWebshop.value);
    pop({ force: true })?.catch(console.error);
}

function addSeatingPlanIfNotInWebshop(id: string | null) {
    // If seating plan is not yet added to webshop, add it.
    if (id && !patchedWebshop.value.meta.seatingPlans.find(p => p.id === id)) {
        let seatingPlan = allSeatingPlans.value.find(p => p.id === id);
        if (!seatingPlan) {
            throw new Error('Seating plan not found');
        }

        // Give the seating plan a new unique id
        seatingPlan = seatingPlan.patch({ id: SeatingPlan.create({}).id });

        const webshopMetaPatch = WebshopMetaData.patch({});
        webshopMetaPatch.seatingPlans.addPut(seatingPlan);
        const webshopPatch = PrivateWebshop.patch({ meta: webshopMetaPatch });
        return { webshopPatch, id: seatingPlan.id };
    }
}

async function deleteSeatingPlan(id: string) {
    // Check if other products use this seating plan
    for (const product of patchedWebshop.value.products) {
        if (product.id === patchedProduct.value.id) {
            continue;
        }
        if (product.seatingPlanId === id) {
            new Toast('Dit zaalplan wordt nog gebruikt door een ander ticket in deze webshop. Verwijder het eerst daar.', 'error red').show();
            return;
        }
    }

    if (!await CenteredMessage.confirm('Ben je zeker dat je dit zaalplan wilt verwijderen?', 'Ja, verwijderen', 'Je kan dit niet ongedaan maken.')) {
        return;
    }

    await sleep(1000);

    if (!await CenteredMessage.confirm('Ben je helemaal zeker?', 'Ja, verwijderen', 'Je kan dit niet ongedaan maken.')) {
        return;
    }

    if (selectedPlan.value == id) {
        selectedPlan.value = null;
    }
    const webshopMetaPatch = WebshopMetaData.patch({});
    webshopMetaPatch.seatingPlans.addDelete(id);
    const webshopPatch = PrivateWebshop.patch({ meta: webshopMetaPatch });
    addWebshopPatch(webshopPatch);
}

const selectedPlan = computed({
    get: () => patchedProduct.value.seatingPlanId,
    set: (seatingPlanId: string | null) => {
        addPatch(Product.patch({ seatingPlanId }));
    },
});

const seatingPlans = computed(() => patchedWebshop.value.meta.seatingPlans);

const otherWebshopSeatingPlans = computed(() => {
    const seatingPlans = organization.value!.webshops.filter(w => w.id !== props.webshop.id).flatMap(w => w.meta.seatingPlans);

    // If seating plans have the same name, only show the last changed one
    const map = new Map<string, SeatingPlan>();
    for (const seatingPlan of seatingPlans) {
        map.set(seatingPlan.name, seatingPlan);
    }

    return Array.from(map.values());
});

const allSeatingPlans = computed(() => {
    // Unique by name
    const map = new Map<string, SeatingPlan>();
    const usedIds = new Set<string>();
    const reservedIds = new Set<string>();

    for (const seatingPlan of seatingPlans.value) {
        reservedIds.add(seatingPlan.id);
    }

    for (const seatingPlan of otherWebshopSeatingPlans.value) {
        if (usedIds.has(seatingPlan.id) || reservedIds.has(seatingPlan.id)) {
            continue;
        }
        map.set(seatingPlan.name, seatingPlan);
        usedIds.add(seatingPlan.id);
    }

    for (const seatingPlan of seatingPlans.value) {
        if (usedIds.has(seatingPlan.id)) {
            continue;
        }
        map.set(seatingPlan.name, seatingPlan);
        usedIds.add(seatingPlan.id);
    }

    return Array.from(map.values()).sort((a, b) => Sorter.byStringProperty(a, b, 'name'));
});

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

function addSeatingPlan() {
    const seatingPlan = SeatingPlan.create({
        name: '',
        categories: [
            SeatingPlanCategory.create({
                id: '0',
                name: 'Standaard',
                price: 0,
            }),
        ],
        sections: [
            SeatingPlanSection.create({
                name: '',
                rows: [
                    SeatingPlanRow.create({
                        label: 'B',
                        seats: [
                            SeatingPlanSeat.create({
                                label: '1',
                                category: '0',
                            }),
                        ],
                    }),
                    SeatingPlanRow.create({
                        label: 'A',
                        seats: [
                            SeatingPlanSeat.create({
                                label: '1',
                                category: '0',
                            }),
                        ],
                    }),
                    // Empty row
                    SeatingPlanRow.create({
                        seats: [],
                    }),
                    // Podium
                    SeatingPlanRow.create({
                        seats: [
                            SeatingPlanSeat.create({
                                label: 'Podium',
                                grow: 1,
                                type: SeatType.Space,
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });

    const webshopMetaPatch = WebshopMetaData.patch({});
    webshopMetaPatch.seatingPlans.addPut(seatingPlan);
    const webshopPatch = PrivateWebshop.patch({ meta: webshopMetaPatch });

    present({
        components: [
            new ComponentWithProperties(EditSeatingPlanView, {
                webshop: patchedWebshop.value.patch(webshopPatch),
                seatingPlan,
                isNew: true,
                saveHandler: (patchedWebshop: AutoEncoderPatchType<PrivateWebshop>) => {
                    addWebshopPatch(webshopPatch.patch(patchedWebshop));
                    selectedPlan.value = seatingPlan.id;
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function editSeatingPlan(seatingPlan: SeatingPlan) {
    const added = addSeatingPlanIfNotInWebshop(seatingPlan.id);
    const patched = added ?? {
        webshopPatch: PrivateWebshop.patch({}),
        id: seatingPlan.id,
    };

    const seatingPlanPatched = seatingPlan.patch({ id: patched.id });

    present({
        components: [
            new ComponentWithProperties(EditSeatingPlanView, {
                webshop: patchedWebshop.value.patch(patched.webshopPatch),
                seatingPlan: seatingPlanPatched,
                isNew: !!added,
                saveHandler: (patchedWebshop: AutoEncoderPatchType<PrivateWebshop>) => {
                    addWebshopPatch(patched.webshopPatch.patch(patchedWebshop));
                    selectedPlan.value = seatingPlanPatched.id;
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

async function importSeatingPlan(event: InputEvent & any) {
    if (importingSeatingPlan.value) {
        return;
    }

    if (!event.target.files || event.target.files.length === 0) {
        return;
    }

    const files = event.target.files as FileList;
    const file = files[0];
    importingSeatingPlan.value = true;

    try {
        const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
        const data = await JSZip.loadAsync(file);
        const jsonFile = data.file('plan.json');

        if (!jsonFile) {
            importingSeatingPlan.value = false;
            new CenteredMessage($t('de1d5cdf-6aa6-4912-828a-82cb53f8abf6')).addCloseButton().show();
            return;
        }

        const blob = await jsonFile.async('blob');
        const text = await blob.text();

        const json = JSON.parse(text);

        // Decode
        const decoded = new VersionBoxDecoder(SeatingPlan as Decoder<SeatingPlan>).decode(new ObjectData(json, { version: 0 }));

        const seatingPlan = decoded.data;

        // Asign a unique id to the seating plan
        const r = SeatingPlan.create({});
        seatingPlan.id = r.id;

        const webshopMetaPatch = WebshopMetaData.patch({});
        webshopMetaPatch.seatingPlans.addPut(seatingPlan);
        const webshopPatch = PrivateWebshop.patch({ meta: webshopMetaPatch });

        present({
            components: [
                new ComponentWithProperties(EditSeatingPlanView, {
                    webshop: patchedWebshop.value.patch(webshopPatch),
                    seatingPlan,
                    isNew: true,
                    saveHandler: (patchedWebshop: AutoEncoderPatchType<PrivateWebshop>) => {
                        addWebshopPatch(webshopPatch.patch(patchedWebshop));
                        selectedPlan.value = seatingPlan.id;
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }
    catch (e) {
        console.error(e);
        const message = $t('977fa720-e451-4dd8-a317-881cf7a409b1');
        new Toast(message, 'error red');
    }
    finally {
        importingSeatingPlan.value = false;
    }

    // Clear selection
    event.target.value = null;
}

defineExpose({
    shouldNavigateAway,
});
</script>
