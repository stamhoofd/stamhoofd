<template>
    <SaveView :loading="saving" title="Algemeen" :disabled="!hasChanges" @save="save">
        <h1>
            Algemene instellingen
        </h1>
        
        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox title="Naam van je vereniging (kort)" error-fields="name" :error-box="errors.errorBox">
                    <input
                        id="organization-name"
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="De naam van je vereniging"
                        autocomplete="organization"
                    >
                </STInputBox>

                <AddressInput v-model="address" title="Adres van je vereniging" :validator="errors.validator" :link-country-to-locale="true" />
            </div>

            <div>
                <UrlInput v-model="website" :title="$t('shared.website.optional')" :placeholder="$t('dashboard.inputs.website.placeholder')" :validator="errors.validator" :required="false" />

                <p class="style-description-small">
                    De link naar de website van jouw vereniging.
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
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, usePop, usePresent } from "@simonbackx/vue-app-navigation";
import { AddressInput, CenteredMessage, ErrorBox, SaveView, STErrorsDefault, STInputBox, UrlInput, useDraggableArray, useErrors, usePatch } from "@stamhoofd/components";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { useOrganizationManager } from "@stamhoofd/networking";
import { Company, OrganizationMetaData } from "@stamhoofd/structures";
import { computed, ref } from "vue";
import EditCompanyView from "./components/EditCompanyView.vue";

const organizationManager = useOrganizationManager();
const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const present = usePresent()
const {patched, hasChanges, addPatch, patch} = usePatch(computed(() => organizationManager.value.organization));
const $t = useTranslate();

const draggableCompanies = useDraggableArray<Company>(() => patched.value.meta.companies, (companies) => addPatch({
    meta: OrganizationMetaData.patch({
        companies
    })
}));

const name = computed({
    get: () => patched.value.name,
    set: (name) => {
        addPatch({
            name
        })
    }
});

const address = computed({
    get: () => patched.value.address,
    set: (address) => {
        addPatch({
            address
        })
    }
});

const website = computed({
    get: () => patched.value.website,
    set: (website) => {
        addPatch({
            website
        })
    }
});

async function addCompany() {
    const company = Company.create({
        name: patched.value.name,
        address: patched.value.address
    });

    await present({
        components: [
            new ComponentWithProperties(EditCompanyView, {
                company,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<Company>) => {
                    const meta = OrganizationMetaData.patch({});
                    meta.companies.addPut(
                        company.patch(patch)
                    );

                    addPatch({
                        meta
                    })
                },
            })
        ],
        modalDisplayStyle: 'popup',
    })
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
                        meta
                    })
                },
                deleteHandler: () => {
                    const meta = OrganizationMetaData.patch({});
                    meta.companies.addDelete(company.id);

                    addPatch({
                        meta
                    })
                }
            })
        ],
        modalDisplayStyle: 'popup',
    })
}


async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        errors.errorBox = null
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        await organizationManager.value.patch(patch.value);
        await pop({force: true})
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        saving.value = false;
    }
}


const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})

</script>
