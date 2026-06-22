<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%HD`)" @save="save">
        <h1>
            {{ $t('%HD') }}
        </h1>

        <p>{{ $t('%HE') }}</p>

        <STErrorsDefault :error-box="errorBox" />

        <hr><h2>{{ $t('%NN') }}</h2>

        <STList class="illustration-list">
            <STListItem :selectable="true" class="left-center" @click="openApiUsers(true)">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/laptop.svg">
                </template>
                <h2 class="style-title-list">
                    {{ $t('%K0') }}
                </h2>
                <p class="style-description">
                    {{ $t('%5P') }}
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem v-if="isStamhoofd" :selectable="true" class="left-center" @click="downloadSettings()">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/box-download.svg">
                </template>
                <h2 class="style-title-list">
                    {{ $t('%NO') }}
                </h2>
                <p class="style-description">
                    {{ $t('%NP') }}
                </p>
                <template #right>
                    <LoadingButton :loading="downloadingSettings">
                        <span class="icon download gray" />
                    </LoadingButton>
                </template>
            </STListItem>

            <STListItem v-if="isStamhoofd" :selectable="true" class="left-center" @click="uploadSettings()">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/box-upload.svg">
                </template>
                <h2 class="style-title-list">
                    {{ $t('%18k') }}
                </h2>
                <p class="style-description">
                    {{ $t('%NQ') }}
                </p>
                <template #right>
                    <LoadingButton :loading="uploadingSettings">
                        <span class="icon upload gray" />
                    </LoadingButton>
                </template>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('%NR') }}</h2>

        <Checkbox v-if="!!STAMHOOFD.domains.webshop" :model-value="getFeatureFlag('webshop-advanced-settings')" @update:model-value="setFeatureFlag('webshop-advanced-settings', !!$event)">
            {{ $t('%15o') }}
        </Checkbox>

        <div v-if="isStamhoofd" key="stamhoofd-settings" class="container">
            <hr><h2>
                {{ $t('%NU') }}
            </h2>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="invoicesEnabled" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1S8') }}
                    </h3>

                    <p class="style-description-small">
                        {{ $t('%1Re') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useTestPayments" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%NV') }}
                    </h3>

                    <p class="style-description-small">
                        {{ $t('%1Hr') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('sso')" @update:model-value="setFeatureFlag('sso', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1O') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%1Xn') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('webshop-auth')" @update:model-value="setFeatureFlag('webshop-auth', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%10') }}
                    </h3>

                    <p class="style-description-small">
                        {{ $t('%1bm') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('organization-receivable-balances')" @update:model-value="setFeatureFlag('organization-receivable-balances', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%NW') }}
                    </h3>
                </STListItem>
            </STList>

            <hr><button class="button text" type="button" @click="applyDiscountCode">
                <span class="icon gift" /><span>{{ $t('%NX') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { ObjectData, patchContainsChanges, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { useDismiss, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';

import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { Organization, OrganizationMetaData, OrganizationPrivateMetaData, PrivatePaymentConfiguration, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';

const context = useContext();
const baseOrganization = useRequiredOrganization();
const organizationManager = useOrganizationManager();
const show = useShow();
const present = usePresent();
const dismiss = useDismiss();
const requestOwner = {};

const errorBox = ref<ErrorBox | null>(null);
const validator = new Validator();
const saving = ref(false);
const downloadingSettings = ref(false);
const uploadingSettings = ref(false);
const organizationPatch = shallowRef<AutoEncoderPatchType<Organization> & AutoEncoder>(
    Organization.patch({ id: baseOrganization.value.id }),
);

const organization = computed(() => baseOrganization.value.patch(organizationPatch.value));
const isStamhoofd = computed(() => organizationManager.value.user.email.endsWith('@stamhoofd.be') || organizationManager.value.user.email.endsWith('@stamhoofd.nl'));
const invoicesEnabled = computed({
    get: () => organization.value.meta.invoicesEnabled ?? false,
    set: (value: boolean) => {
        organizationPatch.value = organizationPatch.value.patch({
            meta: OrganizationMetaData.patch({
                invoicesEnabled: value,
            }),
        });
    },
});
const useTestPayments = computed({
    get: () => organization.value.privateMeta?.useTestPayments ?? STAMHOOFD.environment !== 'production',
    set: (value: boolean) => {
        organizationPatch.value = organizationPatch.value.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                useTestPayments: STAMHOOFD.environment !== 'production' === value ? null : value,
            }),
        });
    },
});
const hasChanges = computed(() => patchContainsChanges(organizationPatch.value, baseOrganization.value, { version: Version }));

onBeforeUnmount(() => Request.cancelAll(requestOwner));

async function openApiUsers(animated = true) {
    await show({
        components: [
            AsyncComponent(() => import('../admins/ApiUsersView.vue'), {}),
        ],
        animated,
    });
}

function getFeatureFlag(flag: string) {
    return organization.value.privateMeta?.featureFlags.includes(flag) ?? false;
}

function setFeatureFlag(flag: string, value: boolean) {
    const featureFlags = organization.value.privateMeta?.featureFlags.filter(f => f !== flag) ?? [];
    if (value) {
        featureFlags.push(flag);
    }
    organizationPatch.value = organizationPatch.value.patch({
        privateMeta: OrganizationPrivateMetaData.patch({
            featureFlags: featureFlags as any,
        }),
    });
}

async function save() {
    if (saving.value) {
        return;
    }

    const errors = new SimpleErrors();
    let valid = false;

    if (errors.errors.length > 0) {
        errorBox.value = new ErrorBox(errors);
    } else {
        errorBox.value = null;
        valid = true;
    }
    valid = valid && await validator.validate();

    if (!valid) {
        return;
    }

    saving.value = true;
    try {
        await organizationManager.value.patch(organizationPatch.value);
        organizationPatch.value = Organization.patch({ id: baseOrganization.value.id });
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
        await dismiss({ force: true });
    } catch (e) {
        errorBox.value = new ErrorBox(e);
    }
    saving.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

function downloadSettings() {
    if (downloadingSettings.value) {
        return;
    }

    const exportedOrganization = Organization.create({
        ...baseOrganization.value,
        webshops: [],
    });
    exportedOrganization.privateMeta!.payconiqAccounts = [];
    exportedOrganization.privateMeta!.buckarooSettings = null;
    exportedOrganization.privateMeta!.mollieProfile = null;
    exportedOrganization.privateMeta!.registrationPaymentConfiguration = PrivatePaymentConfiguration.create({});

    const string = JSON.stringify(new VersionBox(exportedOrganization).encode({ version: Version }), null, 2);
    const url = URL.createObjectURL(new Blob([string], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = Formatter.fileSlug(organization.value.name) + '.json';
    link.click();
    URL.revokeObjectURL(url);
}

function uploadSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            if (typeof reader.result !== 'string') {
                return;
            }

            try {
                uploadingSettings.value = true;
                const parsed: unknown = JSON.parse(reader.result);
                try {
                    await doUploadSettings(parsed);
                    new Toast('De instellingen zijn geïmporteerd', 'success green').show();
                } catch (e) {
                    Toast.fromError(e).show();
                }
            } catch {
                Toast.fromError(new SimpleError({
                    code: 'invalid_json',
                    message: 'Het bestand is geen geldig JSON-bestand',
                })).show();
            }
            uploadingSettings.value = false;
        };
        reader.readAsText(file);
    };
    input.click();
}

async function doUploadSettings(blob: unknown) {
    let importedOrganization: Organization;
    try {
        importedOrganization = new VersionBoxDecoder(Organization as Decoder<Organization>)
            .decode(new ObjectData(blob, { version: 0 })).data;
    } catch (e) {
        throw new SimpleError({
            code: 'invalid_json',
            message: 'Het bestand is geen geldige export: ' + (isSimpleError(e) ? e.getHuman() : e),
        });
    }

    const existing = baseOrganization.value;
    const privatePatch = OrganizationPrivateMetaData.patch({});

    for (const email of importedOrganization.privateMeta?.emails ?? []) {
        if (!existing.privateMeta?.emails.find(e => e.email === email.email)) {
            privatePatch.emails.addPut(email);
        }
    }
    for (const role of importedOrganization.privateMeta?.roles ?? []) {
        if (!existing.privateMeta?.roles.find(r => r.id === role.id)) {
            privatePatch.roles.addPut(role);
        }
    }
    for (const featureFlag of importedOrganization.privateMeta?.featureFlags ?? []) {
        if (!existing.privateMeta?.featureFlags.includes(featureFlag)) {
            privatePatch.featureFlags.addPut(featureFlag);
        }
    }

    const meta = { ...importedOrganization.meta } as any;
    delete meta.registrationPaymentConfiguration;

    const patch = Organization.patch({
        id: existing.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        meta: OrganizationMetaData.patch(meta),
        privateMeta: privatePatch,
        name: importedOrganization.name,
        address: importedOrganization.address,
        website: importedOrganization.website,
        uri: importedOrganization.uri,
    });
    for (const group of importedOrganization.groups) {
        if (!existing.groups.find(g => g.id === group.id)) {
            patch.groups.addPut(group);
        }
    }
    await organizationManager.value.patch(patch);
}

async function applyDiscountCode() {
    await present({
        components: [
            AsyncComponent(() => import('@stamhoofd/components/overlays/InputSheet.vue'), {
                title: 'Kortingscode toepassen',
                description: 'De kortingscode zal meteen worden toegepast op deze vereniging. De andere vereniging ontvangt een e-mail dat de kortingscode is gebruikt, en zal meteen tegoed ontvangen als de vereniging al een betalende klant is (in het andere geval pas later).',
                placeholder: 'Vul hier de code in',
                saveHandler: async (code: string) => {
                    await context.value.authenticatedServer.request({
                        method: 'POST',
                        path: '/organization/register-code',
                        body: {
                            registerCode: code,
                        },
                        owner: requestOwner,
                    });
                    new Toast('De kortingscode is toegepast', 'success green').show();
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

defineExpose({
    shouldNavigateAway,
});
</script>
