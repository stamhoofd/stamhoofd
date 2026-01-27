<template>
    <div class="st-view" data-testid="registration-success-view">
        <STNavigationBar :title="title" />
        <main>
            <h1>{{ title }}</h1>

            <template v-if="!checkout || !checkout.isAdminFromSameOrganization">
                <p v-if="names.length > 0">
                    {{ $t('98d05123-a351-4fb7-a0d7-87f46bcd127d') }}
                </p>

                <p v-else-if="waitingListNames.length > 0">
                    {{ $t('6f719fff-fd1f-4aee-91c1-605ef3d700e3') }}
                </p>

                <p v-else>
                    {{ $t('8ff9d707-c8f8-4d37-85d1-fc578ef31f50') }}
                </p>
            </template>
            <p v-else-if="checkout.sendConfirmationEmail">
                {{ $t('4bb7718d-8198-41c6-b480-d71cd2eeae8b') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss({ force: true })">
                    <span>{{ $t('bef7a2f9-129a-4e1c-b8d2-9003ff0a1f8b') }}</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { STToolbar, useContext } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { BalanceItemRelationType, GroupType, PaymentGeneral, RegisterCheckout, RegistrationWithTinyMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted } from 'vue';

const props = withDefaults(
    defineProps<{
        checkout?: RegisterCheckout | null;
        registrations: RegistrationWithTinyMember[];
        payment?: PaymentGeneral | null;
    }>(),
    {
        checkout: null,
        payment: null,
    },
);
const dismiss = useDismiss();
const context = useContext();
const memberManager = useMemberManager();

onMounted(() => {
    props.checkout?.clear();
    if (!props.checkout) {
        memberManager.family.checkout.clear();
    }

    // Force reload
    context.value.updateData(true, false, false).catch(console.error);
});

let names = Formatter.uniqueArray(props.registrations.filter(r => r.group.type !== GroupType.WaitingList).map(r => r.member.firstName ?? '?'));
const waitingListNames = Formatter.uniqueArray(props.registrations.filter(r => r.group.type === GroupType.WaitingList).map(r => r.member.firstName ?? '?'));

if (props.payment && names.length === 0 && waitingListNames.length === 0) {
    names = Formatter.uniqueArray(
        props.payment.balanceItemPayments.flatMap((p) => {
            if (!p.balanceItem.relations.get(BalanceItemRelationType.Group)) {
                return [];
            }
            const id = p.balanceItem.relations.get(BalanceItemRelationType.Member)?.name?.toString();
            return id ? [id] : [];
        }),
    );
}

const title = computed(() => {
    let t = $t(`2c11315f-96a5-424d-a1e0-f24f2abf5e8a`) + ' ';

    if (names.length > 0) {
        if (names.length > 3) {
            t += Formatter.joinLast([...names.slice(0, 2), (names.length - 2) + ' ' + $t(`6e6fec93-89e1-4a60-8f96-22936f2f68d7`)], ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') + ' ' + $t(`6a96aea2-95ce-4b01-91ff-d0f83333c951`);
        }
        else if (names.length > 1) {
            t += Formatter.joinLast(names, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') + ' ' + $t(`6a96aea2-95ce-4b01-91ff-d0f83333c951`);
        }
        else {
            t += names.join('') + ' ' + $t(`4ca47c6a-ca4e-4f63-b303-b45536072957`);
        }
    }

    if (waitingListNames.length > 0) {
        if (names.length > 0) {
            t += ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ';
        }

        if (waitingListNames.length > 3) {
            t += Formatter.joinLast([...waitingListNames.slice(0, 2), (waitingListNames.length - 2) + ' ' + $t(`6e6fec93-89e1-4a60-8f96-22936f2f68d7`)], ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') + ' ' + $t(`6d897353-bd6c-44cc-8044-5f68cc538b2c`);
        }
        else if (waitingListNames.length > 1) {
            t += Formatter.joinLast(waitingListNames, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') + ' ' + $t(`6d897353-bd6c-44cc-8044-5f68cc538b2c`);
        }
        else {
            t += waitingListNames.join('') + ' ' + $t(`59ecd638-c6a3-45b1-80bb-96c4e3bdde05`);
        }
    }

    if (names.length === 0 && waitingListNames.length === 0) {
        t += $t(`56c85b34-a9f3-46ac-a77c-991a0f463c73`);
    }

    return t;
});

</script>
