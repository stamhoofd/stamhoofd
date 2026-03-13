<template>
    <div class="st-view" data-testid="registration-success-view">
        <STNavigationBar :title="title" />
        <main>
            <h1>{{ title }}</h1>

            <template v-if="!checkout || !checkout.isAdminFromSameOrganization">
                <p v-if="names.length > 0">
                    {{ $t('%eY') }}
                </p>

                <p v-else-if="waitingListNames.length > 0">
                    {{ $t('%eZ') }}
                </p>

                <p v-else>
                    {{ $t('%ea') }}
                </p>
            </template>
            <p v-else-if="checkout.sendConfirmationEmail">
                {{ $t('%eb') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss({ force: true })">
                    <span>{{ $t('%9b') }}</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import STToolbar from '#navigation/STToolbar.vue';
import { useContext } from '#hooks/useContext.ts';
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
    let t = $t(`%zm`) + ' ';

    if (names.length > 0) {
        if (names.length > 3) {
            t += Formatter.joinLast([...names.slice(0, 2), (names.length - 2) + ' ' + $t(`%zn`)], ', ', ' ' + $t(`%M1`) + ' ') + ' ' + $t(`%zo`);
        }
        else if (names.length > 1) {
            t += Formatter.joinLast(names, ', ', ' ' + $t(`%M1`) + ' ') + ' ' + $t(`%zo`);
        }
        else {
            t += names.join('') + ' ' + $t(`%zp`);
        }
    }

    if (waitingListNames.length > 0) {
        if (names.length > 0) {
            t += ' ' + $t(`%M1`) + ' ';
        }

        if (waitingListNames.length > 3) {
            t += Formatter.joinLast([...waitingListNames.slice(0, 2), (waitingListNames.length - 2) + ' ' + $t(`%zn`)], ', ', ' ' + $t(`%M1`) + ' ') + ' ' + $t(`%zq`);
        }
        else if (waitingListNames.length > 1) {
            t += Formatter.joinLast(waitingListNames, ', ', ' ' + $t(`%M1`) + ' ') + ' ' + $t(`%zq`);
        }
        else {
            t += waitingListNames.join('') + ' ' + $t(`%zr`);
        }
    }

    if (names.length === 0 && waitingListNames.length === 0) {
        t += $t(`%zs`);
    }

    return t;
});

</script>
