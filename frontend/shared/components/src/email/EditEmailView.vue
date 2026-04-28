<template>
    <SaveView :loading="saving" :disabled="!hasChangesFull" :title="$t(`%1Fd`)" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
        <h1 v-if="isNew">
            {{ $t('%aR') }}
        </h1>
        <h1 v-else>
            {{ $t('%aS') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%1Os`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%aW`)">
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%1Dq') }}
        </p>

        <EmailInput v-model="emailAddress" :validator="errors.validator" :title="$t(`%1FK`)" :placeholder="$t(`%aX`)" />

        <STInputBox class="max">
            <STList>
                <STListItem v-if="!isDefault" :selectable="true" element-name="button" @click="isDefault = true">
                    <template #left>
                        <IconContainer icon="email-filled" class="">
                            <template #aside>
                                <span class="icon attachment stroke small" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%1Dr') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%1Ds') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-else :selectable="false">
                    <template #left>
                        <IconContainer icon="email-filled" class="success">
                            <template #aside>
                                <span class="icon attachment stroke small" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%1Dt') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%1Du') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="button" @click="editPermissions">
                    <template #left>
                        <IconContainer icon="privacy" class="">
                            <template #aside>
                                <span class="icon success small" />
                            </template>
                        </IconContainer>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%1Dv') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%1Dw') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </STInputBox>

        <template v-if="enableMemberModule && groups.length">
            <hr>
            <h2>{{ $t('%aT') }}</h2>
            <p>
                {{ $t('%aU') }}
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
            <hr>
            <h2>{{ $t('%1Pd') }}</h2>
            <p>
                {{ $t('%aV') }}
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
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, PartialWithoutMethods, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import Checkbox from '#inputs/Checkbox.vue';
import EditResourceRolesView from '#admins/EditResourceRolesView.vue';
import EmailInput from '#inputs/EmailInput.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import IconContainer from '#icons/IconContainer.vue';
import SaveView from '#navigation/SaveView.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatchArray } from '#hooks/usePatchArray.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { Group, GroupPrivateSettings, OrganizationEmail, OrganizationPrivateMetaData, OrganizationRegistrationPeriod, PermissionsResourceType, Platform, PlatformPrivateConfig, WebshopPreview, WebshopPrivateMetaData } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { computed, onMounted, ref } from 'vue';

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
const present = usePresent();

async function editPermissions(animated = true) {
    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditResourceRolesView, {
                description: $t('%1Dx'),
                resource: {
                    id: props.email.id,
                    name: patched.value.name || patched.value.email, description: patched.value.name ? patched.value.email : '',
                    type: PermissionsResourceType.Senders,
                },
            }),
        ],
    });
}

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
    if (saving.value) {
        return;
    }
    if (!await CenteredMessage.confirm($t('%1Fb'), $t('%55'), $t('%1Fc'))) {
        return;
    }
    saving.value = true;

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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
