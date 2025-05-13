<template>
    <SaveView :loading="saving" :disabled="!hasChangesFull" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" @save="save">
        <h1 v-if="isNew">
            {{ $t('c5602934-95a8-437d-b576-eda8d9e6565e') }}
        </h1>
        <h1 v-else>
            {{ $t('ed3e84f0-7ab3-467b-948f-0423ccbf2056') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`a059bcec-d0a2-42c4-a7fc-0fade27c9b0e`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`23302106-6c68-4b4a-8d48-6a7c0debdeb8`)">
        </STInputBox>

        <EmailInput v-model="emailAddress" :validator="errors.validator" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" :placeholder="$t(`70c99ed2-97be-4252-b7c4-6cd46d5c9513`)" />

        <Checkbox v-model="isDefault">
            <h3 class="style-title-list">
                {{ $t('b1bd0cb8-0256-48e8-8b65-9a82314a49a4') }}
            </h3>
            <p class="style-description-small">
                {{ $t('85f5de69-bc8a-4f8d-be68-e6b05f6affce') }}
            </p>
        </Checkbox>

        <template v-if="enableMemberModule && groups.length">
            <hr><h2>{{ $t('c0b96584-ebf2-452b-89e2-0bea5e63eb74') }}</h2>
            <p class="st-list-description">
                {{ $t('a481dcc6-d66e-4098-adc4-66ae9b1ed35f') }}
            </p>

            <STList>
                <STListItem v-for="group in groups" :key="group.group.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox v-model="group.selected" />
                    </template>
                    <h3 class="style-title-list">
                        {{ group.group.settings.name }}
                    </h3>
                </STListItem>
            </STList>
        </template>

        <template v-if="enableWebshopModule && webshops.length">
            <hr><h2>{{ $t('e85a86ee-7751-4791-984b-f67dc1106f6b') }}</h2>
            <p class="st-list-description">
                {{ $t('6fbddfd5-c9af-492a-819f-a22370084cb6') }}
            </p>

            <STList>
                <STListItem v-for="webshop in webshops" :key="webshop.webshop.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox v-model="webshop.selected" />
                    </template>
                    <h3 class="style-title-list">
                        {{ webshop.webshop.meta.name }}
                    </h3>
                </STListItem>
            </STList>
        </template>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, EmailInput, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, STListItem, useErrors, useOrganization, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useOrganizationManager, usePatchOrganizationPeriod, usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { Group, GroupPrivateSettings, OrganizationEmail, OrganizationPrivateMetaData, OrganizationRegistrationPeriod, Platform, PlatformPrivateConfig, WebshopPreview, WebshopPrivateMetaData } from '@stamhoofd/structures';
import { computed, onMounted, Ref, ref } from 'vue';

const props = defineProps<{
    email: OrganizationEmail;
    isNew: boolean;
}>();

const saving = ref(false);
const errors = useErrors();
const groups = ref([]) as Ref<SelectableGroup[]>;
const webshops = ref([]) as Ref<SelectableWebshop[]>;
const organization = useOrganization();
const platform = usePlatform();
const originalArray = computed(() => (organization.value ? organization.value.privateMeta?.emails : platform.value.privateConfig?.emails) ?? []);
const { patched: patchedArray, patch, hasChanges, addPatch: addAPatch, addPut, addArrayPatch } = usePatchArray(originalArray);
const patched = computed(() => patchedArray.value.find(e => e.id === props.email.id) ?? props.email);
const addPatch = (patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationEmail>>) => addAPatch(OrganizationEmail.patch({ id: props.email.id, ...patch }));
const organizationManager = useOrganizationManager();
const owner = useRequestOwner();
const pop = usePop();
const platformManager = usePlatformManager();
const patchOrganizationPeriod = usePatchOrganizationPeriod();

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const emailAddress = computed({
    get: () => patched.value.email,
    set: email => addPatch({ email }),
});

const isDefault = computed({
    get: () => patched.value.default,
    set: (d) => {
        addPatch({ default: d });

        // Remove other defaults
        if (d) {
            for (const email of patchedArray.value) {
                if (email.id !== props.email.id && email.default) {
                    addAPatch(OrganizationEmail.patch({ id: email.id, default: false }));
                }
            }
        }
        else {
            // Remove changes to default
            for (const email of patchedArray.value) {
                if (email.id !== props.email.id && email.default === false) {
                    const originalValue = originalArray.value.find(e => e.id === email.id);
                    if (originalValue && originalValue.default) {
                        addAPatch(OrganizationEmail.patch({ id: email.id, default: true }));
                    }
                }
            }
        }
    },
});

onMounted(() => {
    if (props.isNew) {
        addPut(props.email);
    }

    if (organization.value) {
        for (const group of organization.value.period.groups) {
            groups.value.push(new SelectableGroup(group, group.privateSettings !== null && group.privateSettings.defaultEmailId !== null && group.privateSettings.defaultEmailId === props.email.id));
        }

        for (const webshop of organization.value.webshops) {
            webshops.value.push(new SelectableWebshop(webshop, webshop.privateMeta !== null && webshop.privateMeta.defaultEmailId !== null && webshop.privateMeta.defaultEmailId === props.email.id));
        }
    }
});

const enableMemberModule = computed(() => {
    return organization.value?.meta.modules.useMembers ?? false;
});

const enableWebshopModule = computed(() => {
    return organization.value?.meta.modules.useWebshops ?? false;
});

class SelectableGroup {
    group: Group;
    selected = false;
    constructor(group: Group, selected = false) {
        this.selected = selected;
        this.group = group;
    }
}

class SelectableWebshop {
    webshop: WebshopPreview;
    selected = false;
    constructor(webshop: WebshopPreview, selected = false) {
        this.selected = selected;
        this.webshop = webshop;
    }
}

async function deleteMe() {
    const arr: PatchableArrayAutoEncoder<OrganizationEmail> = new PatchableArray();
    arr.addDelete(props.email.id);

    try {
        if (organization.value) {
            const organizationPatch = organizationManager.value.getPatch().patch({
                privateMeta: OrganizationPrivateMetaData.patch({
                    emails: arr,
                }),
            });

            await organizationManager.value.patch(organizationPatch, { owner, shouldRetry: false });
        }
        else {
            await platformManager.value.patch(Platform.patch({
                privateConfig: PlatformPrivateConfig.patch({
                    emails: arr,
                }),
            }));
        }

        await pop({ force: true });
        saving.value = false;
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        saving.value = false;
    }
}

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;

    if (!await errors.validator.validate()) {
        saving.value = false;
        return;
    }
    try {
        if (organization.value) {
            // First save emails
            const organizationPatch = organizationManager.value.getPatch().patch({
                privateMeta: OrganizationPrivateMetaData.patch({
                    emails: patch.value,
                }),
            });

            for (const webshop of webshops.value) {
                // Check if changed
                const prev = webshop.webshop.privateMeta !== null && webshop.webshop.privateMeta.defaultEmailId !== null && webshop.webshop.privateMeta.defaultEmailId === props.email.id;
                if (prev !== webshop.selected) {
                    organizationPatch.webshops.addPatch(WebshopPreview.patch({
                        id: webshop.webshop.id,
                        privateMeta: WebshopPrivateMetaData.patch({
                            defaultEmailId: webshop.selected ? props.email.id : null,
                        }),
                    }));
                }
            }

            // Save
            await organizationManager.value.patch(organizationPatch, { owner, shouldRetry: false });

            // Clear patch
            patch.value = new PatchableArray();

            // Save period
            let shouldSavePeriod = false;
            const organizationPeriodPatch = OrganizationRegistrationPeriod.patch({ id: organization.value?.period.id });
            for (const group of groups.value) {
                // Check if changed
                const prev = group.group.privateSettings !== null && group.group.privateSettings.defaultEmailId !== null && group.group.privateSettings.defaultEmailId === props.email.id;
                if (prev !== group.selected) {
                    organizationPeriodPatch.groups.addPatch(Group.patch({
                        id: group.group.id,
                        privateSettings: GroupPrivateSettings.patch({
                            defaultEmailId: group.selected ? props.email.id : null,
                        }),
                    }));
                    shouldSavePeriod = true;
                }
            }

            if (shouldSavePeriod) {
                await patchOrganizationPeriod(organizationPeriodPatch);
            }
        }
        else {
            await platformManager.value.patch(Platform.patch({
                privateConfig: PlatformPrivateConfig.patch({
                    emails: patch.value,
                }),
            }));
        }

        await pop({ force: true });
        saving.value = false;
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        saving.value = false;
    }
}

const hasChangesFull = computed(() => {
    if (!hasChanges.value) {
        let otherChanges = false;
        for (const group of groups.value) {
            // Check if changed
            const prev = group.group.privateSettings !== null && group.group.privateSettings.defaultEmailId !== null && group.group.privateSettings.defaultEmailId === props.email.id;
            if (prev !== group.selected) {
                otherChanges = true;
                break;
            }
        }

        for (const webshop of webshops.value) {
            // Check if changed
            const prev = webshop.webshop.privateMeta !== null && webshop.webshop.privateMeta.defaultEmailId !== null && webshop.webshop.privateMeta.defaultEmailId === props.email.id;
            if (prev !== webshop.selected) {
                otherChanges = true;
                break;
            }
        }

        return otherChanges;
    }

    return true;
});

const shouldNavigateAway = async () => {
    if (!hasChangesFull.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
