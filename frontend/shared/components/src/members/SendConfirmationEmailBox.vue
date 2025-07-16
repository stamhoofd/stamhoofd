<template>
    <div v-if="props.group && checkout.isAdminFromSameOrganization" class="container">
        <STList>
            <CheckboxListItem v-model="checkout.sendConfirmationEmail" :disabled="!templates || templates.length === 0" :label="$t('bfbc0e34-10ac-45d8-9a2f-fbdf87bf3cbc')" :description="!templates || templates.length === 0 ? $t('5b9b209e-e78d-46be-ae67-a55c90df4933') : $t('0247f358-5758-4dae-a59e-0d4695adba0b')">
                <template v-if="templates && templates.length && (shouldRememberConfirmationEmail || checkout.sendConfirmationEmail !== getDefaultConfirmationEnabled()) && !props.group.settings.allowRegistrationsByOrganization" #right>
                    <button v-tooltip="$t('471f8c80-a354-4004-a9d0-437d9f90feb4')" class="button icon reverse" :class="{enabled: shouldRememberConfirmationEmail}" type="button" @click.stop="toggleShouldRememberConfirmationEmail()" />
                </template>
            </CheckboxListItem>
        </STList>
        <hr>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { Toast, useValidation, Validator } from '@stamhoofd/components';
import { useFetchOrganizationPeriodForGroup, usePatchOrganizationPeriod, useRequestOwner } from '@stamhoofd/networking';
import { EmailTemplate, EmailTemplateType, Group, GroupPrivateSettings, Organization, OrganizationRegistrationPeriod, RegisterCheckout } from '@stamhoofd/structures';
import { onMounted, Ref, ref } from 'vue';
import { useContext } from '../hooks';
import CheckboxListItem from '../inputs/CheckboxListItem.vue';

const props = defineProps<{
    checkout: RegisterCheckout; // we should auto assign this checkout to all search results and newly created members
    group?: Group; // If you want to add new members to the cart
    groupOrganization: Organization;
    validator: Validator;
}>();

const templates = ref(null) as Ref<null | EmailTemplate[]>;
const owner = useRequestOwner();
const prepareOrganizationPeriod = useFetchOrganizationPeriodForGroup();
const patchOrganizationPeriod = usePatchOrganizationPeriod();
const shouldRememberConfirmationEmail = ref(false);
const context = useContext();

function getDefaultConfirmationEnabled() {
    return !!(props.group && props.group.privateSettings?.sendConfirmationEmailForManualRegistrations);
}

useValidation(props.validator, async () => {
    await saveRememberConfirmationEmail();
});

async function saveRememberConfirmationEmail() {
    if (!shouldRememberConfirmationEmail.value) {
        return;
    }

    if (getDefaultConfirmationEnabled() === props.checkout.sendConfirmationEmail) {
        return; // No change, nothing to do
    }

    const newValue = props.checkout.sendConfirmationEmail;
    await patchGroup(Group.patch({
        privateSettings: GroupPrivateSettings.patch({
            sendConfirmationEmailForManualRegistrations: newValue,
        }),
    }));
}

function toggleShouldRememberConfirmationEmail() {
    shouldRememberConfirmationEmail.value = !shouldRememberConfirmationEmail.value;

    if (shouldRememberConfirmationEmail.value) {
        if (props.checkout.sendConfirmationEmail) {
            Toast.success($t('1dc43852-ac65-4407-ae3f-1575f521b243')).show();
        }
        else {
            Toast.success($t('ee25893a-c254-46fe-b441-5560c6aff841')).show();
        }
    }
    else {
        if (getDefaultConfirmationEnabled() === props.checkout.sendConfirmationEmail) {
            // Cannot really disable
            return;
        }

        if (getDefaultConfirmationEnabled()) {
            Toast.info($t('606e7afd-d6b3-4054-81ec-1d641a271852')).show();
        }
        else {
            Toast.info($t('79f4c175-0429-42fa-918e-6815ac830f5c')).show();
        }
    }
}

async function patchGroup(patch: AutoEncoderPatchType<Group>) {
    if (!props.group) {
        return;
    }
    try {
        patch.id = props.group.id;
        const period = props.groupOrganization.period && props.groupOrganization.period.period.id === props.group.periodId ? props.groupOrganization.period : await prepareOrganizationPeriod(props.group);

        const ppatch = OrganizationRegistrationPeriod.patch({
            id: period.id,
        });
        ppatch.groups.addPatch(patch);
        await patchOrganizationPeriod(ppatch, {
            organizationId: props.group.organizationId,
        });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

onMounted(() => {
    if (props.group && props.checkout.isAdminFromSameOrganization) {
        loadTemplates().catch(console.error);
    }
});

async function loadTemplates() {
    if (!props.group) {
        return;
    }

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/email-templates',
            query: {
                groupIds: [props.group.id],
                types: [
                    EmailTemplateType.RegistrationConfirmation,
                ],
            },
            shouldRetry: true,
            owner,
            decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>),
        });
        templates.value = response.data;
    }
    catch (e) {
        // ignore for now
        console.error(e);
    }
}

</script>
