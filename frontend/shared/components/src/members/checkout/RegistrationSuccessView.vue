<template>
    <div class="st-view">
        <STNavigationBar :title="title"/>
        <main>
            <h1>{{ title }}</h1>

            <template v-if="!checkout || !checkout.isAdminFromSameOrganization">
                <p v-if="names.length > 0">
                    {{ $t('9994ba06-1a78-4e7f-b35e-cb3b87760f0e') }}
                </p>

                <p v-else-if="waitingListNames.length > 0">
                    {{ $t('4357a189-ec02-4c56-ac31-d265c3764a69') }}
                </p>

                <p v-else>
                    {{ $t('170bd2f3-198e-434e-8f6e-b6f7bcca4444') }}
                </p>
            </template>
            <p v-else>
                {{ $t('539a8051-be80-4b9c-9c47-008d80cd53d8') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss({ force: true })">
                    <span>{{ $t('08919911-1157-400d-b89c-265233590019') }}</span>
                    <span class="icon arrow-right"/>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { STToolbar, useContext } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { BalanceItemRelationType, GroupType, PaymentGeneral, RegisterCheckout, RegistrationWithMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted } from 'vue';

const props = withDefaults(
    defineProps<{
        checkout?: RegisterCheckout | null;
        registrations: RegistrationWithMember[];
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
            const id = p.balanceItem.relations.get(BalanceItemRelationType.Member)?.name;
            return id ? [id] : [];
        }),
    );
}

const title = computed(() => {
    let t = 'Hoera! ';

    if (names.length > 0) {
        if (names.length > 3) {
            t += Formatter.joinLast([...names.slice(0, 2), (names.length - 2) + ' andere leden'], ', ', ' en ') + ' zijn ingeschreven';
        }
        else if (names.length > 1) {
            t += Formatter.joinLast(names, ', ', ' en ') + ' zijn ingeschreven';
        }
        else {
            t += names.join('') + ' is ingeschreven';
        }
    }

    if (waitingListNames.length > 0) {
        if (names.length > 0) {
            t += ' en ';
        }

        if (waitingListNames.length > 3) {
            t += Formatter.joinLast([...waitingListNames.slice(0, 2), (waitingListNames.length - 2) + ' andere leden'], ', ', ' en ') + ' zijn ingeschreven op de wachtlijst';
        }
        else if (waitingListNames.length > 1) {
            t += Formatter.joinLast(waitingListNames, ', ', ' en ') + ' zijn ingeschreven op de wachtlijst';
        }
        else {
            t += waitingListNames.join('') + ' is ingeschreven op de wachtlijst';
        }
    }

    if (names.length === 0 && waitingListNames.length === 0) {
        t += 'Gelukt!';
    }

    return t;
});

</script>
