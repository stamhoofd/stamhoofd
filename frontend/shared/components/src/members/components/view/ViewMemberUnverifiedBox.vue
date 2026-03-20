<template>
    <div v-if="shouldShow">
        <div class="hover-box container">
            <hr><h2 class="style-with-button">
                <div>{{ $t('%f0') }}</div>
            </h2>
            <p>{{ $t('%g4') }}</p>
            <dl class="details-grid hover">
                <template v-for="(email, index) of unverifiedEmails">
                    <MemberDetailWithButton :label="formatWithIndex('E-mailadres', index, unverifiedEmails)" :value="email" icon="trash" color="gray" :on-click="() => deleteEmail(email)" />
                </template>

                <template v-for="(phone, index) of unverifiedPhones">
                    <MemberDetailWithButton :label="formatWithIndex($t('%2k'), index, unverifiedPhones)" :value="phone" icon="trash" color="gray" :on-click="() => deletePhone(phone)" />
                </template>

                <template v-for="(address, index) of unverifiedAddresses">
                    <MemberDetailWithButton :label="formatWithIndex('Adres', index, unverifiedAddresses)" :value="addressToLines(address)" icon="trash" color="gray" :on-click="() => deleteAddress(address)" />
                </template>
            </dl>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { AutoEncoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import type { Address, PlatformMember } from '@stamhoofd/structures';
import { CountryHelper, MemberDetails, MemberWithRegistrationsBlob } from '@stamhoofd/structures';
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
        confirmMessage: $t(`%10L`, { phone }),
        key: 'unverifiedPhones',
    });
}

async function deleteEmail(email: string) {
    deleteFromMemberDetails({
        valueToDelete: email,
        confirmMessage: $t(`%10M`, { email }),
        key: 'unverifiedEmails',
    });
}

async function deleteAddress(address: Address) {
    deleteFromMemberDetails({
        valueToDelete: address,
        confirmMessage: $t(`%10N`, { address: address.toString() }),
        key: 'unverifiedAddresses',
    });
}

async function deleteFromMemberDetails<T extends string | number | (AutoEncoder & { id: string })>({ valueToDelete, key, confirmMessage, confirmButtonText }: { valueToDelete: T; confirmMessage: string; confirmButtonText?: string; key: keyof MemberDetails }) {
    const isConfirm = await CenteredMessage.confirm(confirmMessage, confirmButtonText ?? $t(`%CJ`));
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
