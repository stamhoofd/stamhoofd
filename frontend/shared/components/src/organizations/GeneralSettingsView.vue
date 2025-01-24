<template>
    <SaveView :loading="saving" title="Algemeen" :disabled="!hasSomeChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div v-if="isReview" class="container">
            <ReviewCheckbox :data="$reviewCheckboxData" />
        </div>

        <div v-else class="split-inputs">
            <div>
                <STInputBox :title="$t('840ac72d-d4b3-40ea-afb4-b0109e88c640')" error-fields="name" :error-box="errors.errorBox">
                    <input
                        id="organization-name"
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        :placeholder="$t('cb51b737-c4cf-4ea7-aeb5-b5736a43c333')"
                        autocomplete="organization"
                    >
                </STInputBox>

                <AddressInput v-model="address" :title="$t('68c40b9e-30d7-4ce5-8069-f7ca93221906')" :validator="errors.validator" :link-country-to-locale="true" />
            </div>

            <div>
                <UrlInput v-model="website" :title="$t('0e17f20e-e0a6-4fa0-8ec4-378e4325bea5')" :placeholder="$t('5d75775a-a4b5-426a-aea9-b1e75ee5f055')" :validator="errors.validator" :required="false" />

                <p class="style-description-small">
                    {{ $t('ffdbd596-e9c8-4c67-bfdf-41a5199de133') }}
                </p>
            </div>
        </div>

        <hr>

        <h2>Facturatiegegevens</h2>
        <p>Voeg één of meerdere juridische entiteiten toe. Als je zowel een feitelijke vereniging als een VZW hebt, voeg ze dan beide toe. De eerste in de lijst wordt standaard gebruikt als je betalingen uitvoert.</p>

        <p v-if="draggableCompanies.length === 0" class="info-box">
            Geen facturatiegegevens toegevoegd
        </p>

        <STList v-else v-model="draggableCompanies" :draggable="true">
            <template #item="{item: company, index}">
                <STListItem :selectable="true" class="right-stack" @click="editCompany(company)">
                    <template #left>
                        <span class="icon email" />
                    </template>
                    <h3 class="style-title-list">
                        {{ company.name || 'Naamloos' }}
                    </h3>

                    <p v-if="company.VATNumber" class="style-description-small">
                        {{ company.VATNumber }} (BTW-plichtig)
                    </p>
                    <p v-else-if="company.companyNumber" class="style-description-small">
                        {{ company.companyNumber }}
                    </p>
                    <p v-else class="style-description-small">
                        Feitelijke vereniging
                    </p>

                    <p v-if="company.address" class="style-description-small">
                        {{ company.address.shortString() }}
                    </p>
                    <p v-else class="style-description-small">
                        <span class="style-tag error">Adres ontbreekt</span>
                    </p>

                    <p v-if="company.administrationEmail" class="style-description-small">
                        {{ company.administrationEmail }}
                    </p>

                    <template #right>
                        <span v-if="index === 0" class="style-tag">
                            Standaard
                        </span>
                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </template>
        </STList>

        <p class="style-button-bar">
            <button class="button text" type="button" @click="addCompany">
                <span class="icon add" />
                <span>Toevoegen</span>
            </button>
        </p>

        <div v-if="!isReview">
            <div v-for="category of recordCategories" :key="category.id" class="container">
                <hr>
                <FillRecordCategoryBox :category="category" :value="patched" :validator="errors.validator" :level="2" :all-optional="false" :force-mark-reviewed="true" @patch="patchAnswers" />
            </div>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AddressInput, CenteredMessage, ErrorBox, FillRecordCategoryBox, SaveView, STErrorsDefault, STInputBox, UrlInput, useDraggableArray, useErrors, usePatch, usePlatform, useReview } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useOrganizationManager } from '@stamhoofd/networking';
import { Company, OrganizationMetaData, OrganizationPrivateMetaData, PatchAnswers, SetupStepType } from '@stamhoofd/structures';
import { computed, ref, watch } from 'vue';
import ReviewCheckbox from '../ReviewCheckbox.vue';
import EditCompanyView from './components/EditCompanyView.vue';

const props = defineProps<{ isReview?: boolean }>();

const title = computed(() => props.isReview ? $t('31df7737-2a25-4a6c-9766-39acc3ccdbc8') : 'Algemene instellingen');
const organizationManager = useOrganizationManager();
const platform = usePlatform();

const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const present = usePresent();
const { patched, hasChanges, addPatch, patch } = usePatch(computed(() => organizationManager.value.organization));
const $t = useTranslate();
const { $overrideIsDone, $hasChanges: $hasReviewChanges, save: saveReview, $reviewCheckboxData } = useReview(SetupStepType.Companies);

const hasSomeChanges = computed(() => {
    if (props.isReview) {
        return hasChanges.value || $hasReviewChanges.value;
    }

    return hasChanges.value;
});

const draggableCompanies = useDraggableArray<Company>(() => patched.value.meta.companies, companies => addPatch({
    meta: OrganizationMetaData.patch({
        companies,
    }),
}));

watch(draggableCompanies, (companies) => {
    $overrideIsDone.value = companies.length > 0;
});

const name = computed({
    get: () => patched.value.name,
    set: (name) => {
        addPatch({
            name,
        });
    },
});

const address = computed({
    get: () => patched.value.address,
    set: (address) => {
        addPatch({
            address,
        });
    },
});

const website = computed({
    get: () => patched.value.website,
    set: (website) => {
        addPatch({
            website,
        });
    },
});

const recordCategories = computed(() =>
    platform.value.config.organizationLevelRecordsConfiguration.recordCategories.filter(x => x.isEnabled(patched.value)),
);

async function addCompany() {
    const company = Company.create({
        name: patched.value.name,
        address: patched.value.address,
    });

    await present({
        components: [
            new ComponentWithProperties(EditCompanyView, {
                company,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<Company>) => {
                    const meta = OrganizationMetaData.patch({});
                    meta.companies.addPut(
                        company.patch(patch),
                    );

                    addPatch({
                        meta,
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function editCompany(company: Company) {
    if (!company.id) {
        return;
    }
    await present({
        components: [
            new ComponentWithProperties(EditCompanyView, {
                company,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<Company>) => {
                    patch.id = company.id;
                    const meta = OrganizationMetaData.patch({});
                    meta.companies.addPatch(patch);

                    addPatch({
                        meta,
                    });
                },
                deleteHandler: () => {
                    const meta = OrganizationMetaData.patch({});
                    meta.companies.addDelete(company.id);

                    addPatch({
                        meta,
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function patchAnswers(patch: PatchAnswers) {
    addPatch({
        privateMeta: OrganizationPrivateMetaData.patch({ recordAnswers: patch }),
    });
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        if (hasChanges.value) {
            errors.errorBox = null;
            if (!await errors.validator.validate()) {
                saving.value = false;
                return;
            }
            await organizationManager.value.patch(patch.value);
        }

        if (props.isReview) {
            await saveReview();
        }

        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
    }
}

const shouldNavigateAway = async () => {
    if (!hasSomeChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
