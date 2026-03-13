<template>
    <div v-if="props.group && checkout.isAdminFromSameOrganization" class="container">
        <STList>
            <CheckboxListItem v-model="checkout.sendConfirmationEmail" :disabled="!templates || templates.length === 0" :label="$t('%1Av')" :description="!templates || templates.length === 0 ? $t('%1Aw') : $t('%1Ax')">
                <template v-if="templates && templates.length && (shouldRememberConfirmationEmail || checkout.sendConfirmationEmail !== getDefaultConfirmationEnabled()) && !props.group.settings.allowRegistrationsByOrganization" #right>
                    <button v-tooltip="$t('%1Ay')" class="button icon reverse" :class="{enabled: shouldRememberConfirmationEmail}" type="button" @click.stop="toggleShouldRememberConfirmationEmail()" />
                </template>
            </CheckboxListItem>
        </STList>
        <hr>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { Toast } from '#overlays/Toast.ts';
import { useValidation } from '#errors/useValidation.ts';
import { Validator } from '#errors/Validator.ts';
import { useFetchOrganizationPeriodForGroup } from '@stamhoofd/networking/hooks/useFetchOrganizationPeriodForGroup';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
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
            Toast.success($t('%1Az')).show();
        }
        else {
            Toast.success($t('%1B0')).show();
        }
    }
    else {
        if (getDefaultConfirmationEnabled() === props.checkout.sendConfirmationEmail) {
            // Cannot really disable
            return;
        }

        if (getDefaultConfirmationEnabled()) {
            Toast.info($t('%1B1')).show();
        }
        else {
            Toast.info($t('%1B2')).show();
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
