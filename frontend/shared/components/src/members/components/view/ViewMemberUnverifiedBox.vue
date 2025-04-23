<template>
    <div v-if="shouldShow">
        <div class="hover-box container">
            <hr><h2 class="style-with-button">
                <div>{{ $t('94823cfc-f583-4288-bf44-0a7cfec9e61f') }}</div>
            </h2>
            <p>{{ $t('47e082e2-def8-4c2a-909e-5f8d3b17f92c') }}</p>
            <dl class="details-grid hover">
                <template v-for="(email, index) of unverifiedEmails">
                    <MemberDetailWithButton :label="formatWithIndex('E-mailadres', index, unverifiedEmails)" :value="email" icon="trash" color="gray" :on-click="() => deleteEmail(email)" />
                </template>

                <template v-for="(phone, index) of unverifiedPhones">
                    <MemberDetailWithButton :label="formatWithIndex($t('90d84282-3274-4d85-81cd-b2ae95429c34'), index, unverifiedPhones)" :value="phone" icon="trash" color="gray" :on-click="() => deletePhone(phone)" />
                </template>

                <template v-for="(address, index) of unverifiedAddresses">
                    <MemberDetailWithButton :label="formatWithIndex('Adres', index, unverifiedAddresses)" :value="addressToLines(address)" icon="trash" color="gray" :on-click="() => deleteAddress(address)" />
                </template>
            </dl>
        </div>
    </div>
</template>

<script setup lang="ts">
import { AutoEncoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Address, CountryHelper, MemberDetails, MemberWithRegistrationsBlob, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useCountry } from '../../../hooks';
import { CenteredMessage } from '../../../overlays/CenteredMessage';
import { Toast } from '../../../overlays/Toast';
import { usePlatformFamilyManager } from '../../PlatformFamilyManager';
import MemberDetailWithButton from '../detail/MemberDetailWithButton.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();

const platformFamilyManager = usePlatformFamilyManager();

const currentCountry = useCountry();

const memberDetails = computed(() => props.member.patchedMember.details);
const unverifiedAddresses = computed(() => memberDetails.value.unverifiedAddresses ?? []);
const unverifiedPhones = computed(() => memberDetails.value.unverifiedPhones ?? []);
const unverifiedEmails = computed(() => memberDetails.value.unverifiedEmails ?? []);

const shouldShow = computed(() => unverifiedAddresses.value.length > 0 || unverifiedPhones.value.length > 0 || unverifiedEmails.value.length > 0);

function formatWithIndex<T>(label: string, index: number, array: T[]) {
    if (array.length === 1) return label;
    return `${label} ${index + 1}`;
}

function addressToLines(address: Address): string[] {
    const lines = [`${address.street} ${address.number}`, `${address.postalCode} ${address.city}`];
    if (address.country !== currentCountry.value) {
        lines.push(CountryHelper.getName(address.country));
    }
    return lines;
}

async function deletePhone(phone: string) {
    deleteFromMemberDetails({
        valueToDelete: phone,
        confirmMessage: $t(`b1fdf269-a84e-44e8-9d2d-ef57919e3698`, { phone }),
        key: 'unverifiedPhones',
    });
}

async function deleteEmail(email: string) {
    deleteFromMemberDetails({
        valueToDelete: email,
        confirmMessage: $t(`9860af1d-e902-4f21-b8bb-98e1e401f87f`, { email }),
        key: 'unverifiedEmails',
    });
}

async function deleteAddress(address: Address) {
    deleteFromMemberDetails({
        valueToDelete: address,
        confirmMessage: $t(`d233219f-cbc2-4b54-82df-494e068d754b`, { address: address.toString() }),
        key: 'unverifiedAddresses',
    });
}

async function deleteFromMemberDetails<T extends string | number | (AutoEncoder & { id: string })>({ valueToDelete, key, confirmMessage, confirmButtonText }: { valueToDelete: T; confirmMessage: string; confirmButtonText?: string; key: keyof MemberDetails }) {
    const isConfirm = await CenteredMessage.confirm(confirmMessage, confirmButtonText ?? $t(`faae9011-c50d-4ada-aed0-c1b578782b2a`));
    if (isConfirm) {
        const member = props.member;
        const membersPatch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;

        let detailsPatch: PatchableArray<any, any, any>;

        if (typeof valueToDelete === 'string' || typeof valueToDelete === 'number') {
            const arrayPatch = new PatchableArray<typeof valueToDelete, typeof valueToDelete, typeof valueToDelete>();
            arrayPatch.addDelete(valueToDelete);
            detailsPatch = arrayPatch;
        }
        else {
            const arrayPatch = new PatchableArray() as PatchableArrayAutoEncoder<AutoEncoder & { id: string }>;
            arrayPatch.addDelete(valueToDelete.id);
            detailsPatch = arrayPatch;
        }

        membersPatch.addPatch(MemberWithRegistrationsBlob.patch({
            id: member.id,
            details: MemberDetails.patch({ [key]: detailsPatch }),
        }));

        try {
            await platformFamilyManager.isolatedPatch([member], membersPatch);
        }
        catch (error) {
            Toast.fromError(error).show();
        }
    }
}
</script>
