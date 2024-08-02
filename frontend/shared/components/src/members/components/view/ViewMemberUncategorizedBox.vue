<template>
    <div v-if="shouldShow">

        <div class="hover-box container">
            <hr>
            <h2 class="style-with-button"><div>Niet-toegekende gegevens</div></h2>
            <p>Deze gegevens konden niet automatisch toegekend worden aan het lid of aan de ouders. Je kan ze toevoegen of verwijderen.</p>
            <dl class="details-grid hover">
                <template v-for="(email, index) of uncategorizedEmails">
                    <MemberDetailWithButton
                        :label="formatWithIndex('E-mailadres', index, uncategorizedEmails)"
                        :value="email" icon="trash" color="gray"
                        :on-delete="() => deleteEmail(email)"/>
                </template>

                <template v-for="(phone, index) of uncategorizedPhones">
                    <MemberDetailWithButton
                        :label="formatWithIndex($t('shared.inputs.mobile.label'), index, uncategorizedPhones)"
                        :value="phone" icon="trash" color="gray"
                        :on-delete="() => deletePhone(phone)"/>
                </template>

                <template v-for="(address, index) of uncategorizedAddresses">
                    <MemberDetailWithButton
                        :label="formatWithIndex('Adres', index, uncategorizedAddresses)"
                        :value="addressToLines(address)" icon="trash" color="gray"
                        :on-delete="() => deleteAddress(address)"/>
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
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>();

const platformFamilyManager = usePlatformFamilyManager();

const currentCountry = useCountry();

const memberDetails = computed(() => props.member.patchedMember.details);
const uncategorizedAddresses = computed(() => memberDetails.value.uncategorizedAddresses ?? []);
const uncategorizedPhones = computed(() => memberDetails.value.uncategorizedPhones ?? []);
const uncategorizedEmails = computed(() => memberDetails.value.uncategorizedEmails ?? []);

const shouldShow = computed(() => uncategorizedAddresses.value.length > 0 || uncategorizedPhones.value.length > 0 || uncategorizedEmails.value.length > 0);

function formatWithIndex<T>(label: string, index: number, array: T[]) {
    if(array.length === 1) return label;
    return `${label} ${index + 1}`
}

function addressToLines(address: Address): string[] {
    const lines = [`${address.street} ${address.number}`, `${address.postalCode} ${address.city}`];
    if(address.country !== currentCountry.value) {
        lines.push(CountryHelper.getName(address.country));
    }
    return lines;
}

async function deletePhone(phone: string) {
    deleteFromMemberDetails({
        valueToDelete: phone,
        confirmMessage: `Weet je zeker dat je het gsm nummer '${phone}' wilt verwijderen?`,
        key: 'uncategorizedPhones'
    });
}

async function deleteEmail(email: string) {
    deleteFromMemberDetails({
        valueToDelete: email,
        confirmMessage: `Weet je zeker dat je het e-mailadres '${email}' wilt verwijderen?`,
        key: 'uncategorizedEmails'
    });
}

async function deleteAddress(address: Address) {
    deleteFromMemberDetails({
        valueToDelete: address,
        confirmMessage: `Weet je zeker dat je het adres '${address}' wilt verwijderen?`,
        key: 'uncategorizedAddresses'
    });
}

async function deleteFromMemberDetails<T extends string | number | (AutoEncoder & {id: string})>({valueToDelete, key,confirmMessage, confirmButtonText}: {valueToDelete: T, confirmMessage: string, confirmButtonText?: string, key: keyof MemberDetails}) {
    const isConfirm = await CenteredMessage.confirm(confirmMessage, confirmButtonText ?? 'Verwijderen');
    if(isConfirm) {
        const member = props.member;
        const membersPatch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;

        let detailsPatch: PatchableArray<any, any, any>;
            
        if(typeof valueToDelete === 'string' || typeof valueToDelete === 'number') {
            const arrayPatch = new PatchableArray<typeof valueToDelete, typeof valueToDelete, typeof valueToDelete>();
            arrayPatch.addDelete(valueToDelete);
            detailsPatch = arrayPatch;
        } else {
            const arrayPatch = new PatchableArray() as PatchableArrayAutoEncoder<AutoEncoder & {id: string}>;
            arrayPatch.addDelete(valueToDelete.id);
            detailsPatch = arrayPatch;
        }

        membersPatch.addPatch(MemberWithRegistrationsBlob.patch({
            id: member.id,
            details: MemberDetails.patch({[key]: detailsPatch})
        }));
    
        try {
            await platformFamilyManager.isolatedPatch([member], membersPatch);
        } catch(error) {
            Toast.fromError(error).show();
        }
    }
}
</script>

<style lang="scss" scoped>
.info-text {
    padding-bottom: 15px;
}
</style>
