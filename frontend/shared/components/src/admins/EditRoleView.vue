<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Titel" error-fields="name" :error-box="errors.errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze rol"
                autocomplete=""
            >
        </STInputBox>

        <template v-if="app === 'admin'">
            <hr>
            <h2>
                Algemeen
            </h2>
            <p>In de toekomst kan je dit per verenigingstag instellen. Voor diepgaandere toegang tot één specifieke vereniging moet je een persoon beheerder maken van die specifieke vereniging.</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="platformLoginAs" />
                    </template>
                    <h3 class="style-title-list">
                        Inloggen als alle verenigingen
                    </h3>
                    <p class="style-description-small">
                        Beheerders met deze rechten kunnen bij gelijk welke vereniging inloggen en hebben daar dezelfde rechten als een hoofdbeheerder van die vereniging. Deze beheerders krijgen dus toegang tot alle data van die vereniging, inclusief leden.
                    </p>
                </STListItem>
            </STList>
        </template>

        <template v-if="false">
            <hr>
            <h2>Basistoegang</h2>
            <p>Geef deze beheerders snel lees of bewerk toegang tot alle onderdelen van jouw vereniging.</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="basePermission" value="None" />
                    </template>
                    <h3 class="style-title-list">
                        Geen
                    </h3>
                    <p v-if="basePermission === 'None'" class="style-description-small">
                        Deze beheerders kunnen geen onderdelen zien of bewerken tenzij expliciet hieronder toegang werd gegeven.
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="basePermission" value="Read" />
                    </template>
                    <h3 class="style-title-list">
                        Lezen
                    </h3>
                    <p v-if="basePermission === 'Read'" class="style-description-small">
                        Deze beheerders kunnen alle onderdelen zien. Je kan ze eventueel bewerk toegang geven tot specifieke onderdelen.
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="basePermission" value="Write" />
                    </template>
                    <h3 class="style-title-list">
                        Bewerken
                    </h3>
                    <p v-if="basePermission === 'Write'" class="style-description-small">
                        Deze beheerders kunnen alle onderdelen zien en bewerken. Je kan ze eventueel toegang geven tot instellingen (volledige toegang) voor specifieke onderdelen.
                    </p>
                </STListItem>
            </STList>
        </template>

        <template v-if="enableActivities && categories.length">
            <hr>
            <h2>
                Inschrijvingscategorieën
            </h2>
            <p>Geef deze beheerders meteen toegang tot alle inschrijvingsgroepen uit een categorie, of geef ze zelf de mogelijkheid om inschrijvingsgroepen (bv. activiteiten of leeftijdsgroepen) aan te maken in één of meerdere categorieën. Enkel hoofdbeheerders kunnen categorieën toevoegen en bewerken.</p>
           
            <STList>
                <ResourcePermissionRow 
                    v-for="category in categories" 
                    :key="category.id" 
                    :role="patched" 
                    :resource="{id: category.id, name: category.settings.name, type: PermissionsResourceType.GroupCategories }" 
                    :configurable-access-rights="[AccessRight.OrganizationCreateGroups]"
                    type="resource" 
                    @patch:role="addPatch" 
                />
            </STList>
        </template>

        <div v-if="enableMemberModule && groups.length" class="container">
            <hr>
            <h2>
                Individuele inschrijvingsgroepen
            </h2>

            <STList>
                <ResourcePermissionRow 
                    v-for="group in groups" 
                    :key="group.id" 
                    :role="patched" 
                    :resource="{id: group.id, name: group.settings.name, type: PermissionsResourceType.Groups }" 
                    :configurable-access-rights="[]"
                    type="resource" 
                    @patch:role="addPatch" 
                />
            </STList>
        </div>

        <div v-if="enableWebshopModule" class="container">
            <hr>
            <h2>Webshops</h2>
            <p>Voeg webshops toe om deze beheerders toegang te geven tot een specifieke webshop</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="createWebshops" />
                    </template>
                    Kan nieuwe webshops maken
                </STListItem>
                <ResourcePermissionRow 
                    v-for="webshop in webshops" 
                    :key="webshop.id" 
                    :role="patched" 
                    :resource="{id: webshop.id, name: webshop.meta.name, type: PermissionsResourceType.Webshops }" 
                    :configurable-access-rights="webshop.hasTickets ? [AccessRight.WebshopScanTickets] : []"
                    type="resource" 
                    @patch:role="addPatch" 
                />
            </STList>
        </div>

        <div v-if="app !== 'admin'" class="container">
            <hr>
            <h2>
                Toegang tot gegevens van leden
            </h2>
            <p>Standaard heeft elke beheerder die een lid kan bekijken of bewerken, toegang tot de algemene informatie van dat lid (naam, geboortedatum, gender, adres, ouders, noodcontactpersonen). Je kan bepaalde beheerders ook toegang geven tot meer gegevens hieronder.</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="readFinancialData" :disabled="financeDirector" />
                    </template>
                    <h3 class="style-title-list">
                        Financiële gegevens bekijken
                    </h3>
                    <p class="style-description-small">
                        Bekijk hoeveel een lid precies heeft betaald of nog moet betalen, en bekijk of het lid recht heeft op een verlaagd tarief.
                    </p>
                </STListItem>

                <STListItem v-if="financeDirector || readFinancialData || writeFinancialData" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="writeFinancialData" :disabled="financeDirector" />
                    </template>
                    <h3 class="style-title-list">
                        Financiële gegevens bewerken
                    </h3>
                    <p class="style-description-small">
                        Voeg openstaande bedragen toe of verwijder ze, en pas de betaalstatus van een lid aan.
                    </p>
                </STListItem>

                <ResourcePermissionRow 
                    v-for="recordCategory in recordCategories" 
                    :key="recordCategory.id" 
                    :role="patched" 
                    :resource="{id: recordCategory.id, name: recordCategory.name, type: PermissionsResourceType.RecordCategories }" 
                    :configurable-access-rights="[]"
                    type="resource" 
                    @patch:role="addPatch" 
                />
            </STList>
        </div>


        <template v-if="organization">
            <hr>
            <h2>Boekhouding</h2>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="financeDirector" />
                    </template>
                    <h3 class="style-title-list">
                        Volledige toegang
                    </h3>
                    <p class="style-description-small">
                        Beheerders met deze toegang krijgen toegang tot alle financiële gegevens van jouw organisatie, en kunnen overschrijvingen als betaald markeren.
                    </p>
                </STListItem>
                <STListItem v-if="!financeDirector" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="managePayments" />
                    </template>
                    <h3 class="style-title-list">
                        Overschrijvingen beheren
                    </h3>
                    <p class="style-description-small">
                        Beheerders met deze toegang kunnen openstaande overschrijvingen bekijken en markeren als betaald.
                    </p>
                </STListItem>
            </STList>
        </template>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                Verwijder deze rol
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>

        <template v-if="!isNew">
            <hr>
            <h2>Beheerders met deze rol</h2>

            <Spinner v-if="loading" />
            <template v-else>
                <p v-if="filteredAdmins.length === 0" class="info-box">
                    Er zijn geen beheerders met deze rol.
                </p>
                <STList v-else>
                    <STListItem v-for="admin in filteredAdmins" :key="admin.id">
                        <h2 class="style-title-list">
                            {{ admin.firstName }} {{ admin.lastName }}
                        </h2>
                        <p class="style-description-small">
                            {{ admin.email }}
                        </p>
                    </STListItem>
                </STList>
            </template>
        </template>
    </SaveView>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SaveView, Spinner, useAppContext, useErrors, useOrganization, usePatch, usePlatform } from '@stamhoofd/components';
import { AccessRight, Group, GroupCategory, PermissionRoleDetailed, PermissionsResourceType, User, WebshopPreview } from '@stamhoofd/structures';
import { Ref, computed, ref } from 'vue';
import ResourcePermissionRow from './components/ResourcePermissionRow.vue';
import { useAdmins } from './hooks/useAdmins';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    role: PermissionRoleDetailed;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PermissionRoleDetailed>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => props.isNew ? 'Nieuwe rol' : props.role.name);
const enableWebshopModule = computed(() => organization.value?.meta?.packages.useWebshops ?? false);
const enableMemberModule = computed(() => organization.value?.meta?.packages.useMembers ?? false);
const enableActivities = computed(() => organization.value?.meta?.packages.useActivities ?? false);
const pop = usePop();
const app = useAppContext()

const {sortedAdmins, loading, getPermissions} = useAdmins()
const organization = useOrganization()
const platform = usePlatform()
const {patched, addPatch, hasChanges, patch} = usePatch(props.role);
const groups: Ref<Group[]> = computed(() => organization.value?.adminAvailableGroups ?? [])
const webshops: Ref<WebshopPreview[]> = computed(() => organization.value?.webshops ?? [])
const categories: Ref<GroupCategory[]> = computed(() => organization.value?.getCategoryTree().categories ?? [])
const recordCategories = computed(() => {
    const base = organization.value?.meta.recordsConfiguration.recordCategories?.slice() ?? [];

    for (const r of platform.value.config.recordsConfiguration.recordCategories) {
        if (r.defaultEnabled) {
            base.push(r)
        } else {
            if (organization.value?.meta.recordsConfiguration.inheritedRecordCategories.has(r.id)) {
                base.push(r)
            }
        }
    }

    return base;
})

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (name.value.length === 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Gelieve een titel in te vullen",
                field: "name"
            })
        }
        await props.saveHandler(patch.value)
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm("Ben je zeker dat je deze rol wilt verwijderen?", "Verwijderen")) {
        return
    }
        
    deleting.value = true;
    try {
        await props.deleteHandler()
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    deleting.value = false;
};

const hasAdminRole = (admin: User) => {
    const permissions = getPermissions(admin);
    return permissions?.hasRole(props.role) ?? false;
};

const filteredAdmins = computed(() => sortedAdmins.value.filter((a) => hasAdminRole(a)));

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name}),
});

const basePermission = computed({
    get: () => patched.value.level,
    set: (level) => addPatch({level}),
});

const createWebshops = useAccessRightSetter(AccessRight.OrganizationCreateWebshops);
const financeDirector = useAccessRightSetter(AccessRight.OrganizationFinanceDirector);
const managePayments = useAccessRightSetter(AccessRight.OrganizationManagePayments);

const readFinancialData = useAccessRightSetter(AccessRight.MemberReadFinancialData);
const writeFinancialData = useAccessRightSetter(AccessRight.MemberWriteFinancialData);
const platformLoginAs = useAccessRightSetter(AccessRight.PlatformLoginAs);

function useAccessRightSetter(accessRight: AccessRight) {
    return computed({
        get: () => patched.value.hasAccessRight(accessRight),
        set: (value) => {
            const patch = PermissionRoleDetailed.patch({})
            
            // Always delete to prevent duplicate insertions
            patch.accessRights.addDelete(accessRight)
            if (value) {
                patch.accessRights.addPut(accessRight)
            }

            addPatch(patch)
        },
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})
</script>
