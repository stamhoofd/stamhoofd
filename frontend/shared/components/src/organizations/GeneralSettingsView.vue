<template>
    <SaveView :loading="saving" :disabled="!hasSomeChanges" :title="$t(`%Lb`)" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div v-if="isReview" class="container">
            <ReviewCheckbox :data="reviewCheckboxData" />
        </div>

        <div class="split-inputs">
            <div>
                <STInputBox :title="$t('%8D')" error-fields="name" :error-box="errors.errorBox">
                    <input id="organization-name" ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t('%8C')" autocomplete="organization">
                </STInputBox>

                <AddressInput v-model="address" :optional-except-city="true" :title="$t('%8a')" :validator="errors.validator" :link-country-to-locale="true" />
            </div>

            <div>
                <STInputBox v-if="STAMHOOFD.userMode === 'platform'" :title="$t('%7C')" error-fields="uri" :error-box="errors.errorBox">
                    <input id="organization-uri" :value="uri" class="input" type="text" disabled>
                </STInputBox>

                <UrlInput v-model="website" :title="$t('%5I')" :placeholder="$t('%2n')" :validator="errors.validator" :required="false" />

                <p class="style-description-small">
                    {{ $t('%8b') }}
                </p>
            </div>
        </div>

        <hr><h2>{{ $t('%1Ke') }}</h2>
        <p>{{ $t('%gC') }}</p>

        <p v-if="draggableCompanies.length === 0" class="info-box">
            {{ $t('%gD') }}
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
                        {{ company.VATNumber }} {{ $t('%Gn') }}
                    </p>
                    <p v-else-if="company.companyNumber" class="style-description-small">
                        {{ company.companyNumber }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('%1CH') }}
                    </p>

                    <p v-if="company.address" class="style-description-small">
                        {{ company.address.shortString() }}
                    </p>
                    <p v-else class="style-description-small">
                        <span class="style-tag error">{{ $t('%gE') }}</span>
                    </p>

                    <p v-if="company.administrationEmail" class="style-description-small">
                        {{ company.administrationEmail }}
                    </p>

                    <template #right>
                        <span v-if="index === 0" class="style-tag">
                            {{ $t('%v6') }}
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
                <span>{{ $t('%SN') }}</span>
            </button>
        </p>

        <div v-for="category of recordCategories" :key="category.id" class="container">
            <hr><FillRecordCategoryBox :category="category" :value="patched" :validator="errors.validator" :level="2" :all-optional="false" :force-mark-reviewed="true" @patch="patchAnswers" />
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import AddressInput from '#inputs/AddressInput.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import FillRecordCategoryBox from '#records/components/FillRecordCategoryBox.vue';
import SaveView from '#navigation/SaveView.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STInputBox from '#inputs/STInputBox.vue';
import UrlInput from '#inputs/UrlInput.vue';
import { useDraggableArray } from '#hooks/useDraggableArray.ts';
import { useErrors } from '#errors/useErrors.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useReview } from '#useReview.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { Company, OrganizationMetaData, OrganizationPrivateMetaData, PatchAnswers, SetupStepType } from '@stamhoofd/structures';
import { computed, ref, watch } from 'vue';
import ReviewCheckbox from '../ReviewCheckbox.vue';
import EditCompanyView from './components/EditCompanyView.vue';

const props = defineProps<{ isReview?: boolean }>();

const title = computed(() => props.isReview ? $t('%4d') : $t(`%10T`));
const organizationManager = useOrganizationManager();
const platform = usePlatform();

const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const present = usePresent();
const { patched, hasChanges, addPatch, patch } = usePatch(computed(() => organizationManager.value.organization));

const { overrideIsDone, hasChanges: hasReviewChanges, save: saveReview, reviewCheckboxData } = useReview(SetupStepType.Companies);

const hasSomeChanges = computed(() => {
    if (props.isReview) {
        return hasChanges.value || hasReviewChanges.value;
    }

    return hasChanges.value;
});

const draggableCompanies = useDraggableArray<Company>(() => patched.value.meta.companies, companies => addPatch({
    meta: OrganizationMetaData.patch({
        companies,
    }),
}));

watch(draggableCompanies, (companies) => {
    overrideIsDone.value = companies.length > 0;
}, { immediate: true });

const name = computed({
    get: () => patched.value.name,
    set: (name) => {
        addPatch({
            name,
        });
    },
});

const uri = computed(() => patched.value.uri);

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
        errors.errorBox = null;
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        await organizationManager.value.patch(patch.value);

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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
