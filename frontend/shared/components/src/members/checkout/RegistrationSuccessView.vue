<template>
    <div class="st-view">
        <STNavigationBar :title="title" />
        <main>
            <h1>{{ title }}</h1>

            <template v-if="!checkout || !checkout.isAdminFromSameOrganization">
                <p v-if="names.length > 0">
                    Je ontvangt een extra bevestiging via e-mail. Als er in de toekomst gegevens wijzigen kan je die vanaf nu beheren via het ledenportaal.
                </p>

                <p v-else-if="waitingListNames.length > 0">
                    We houden je op de hoogte van jouw status op de wachtlijst.
                </p>

                <p v-else>
                    We houden je op de hoogte.
                </p>
            </template>
            <p v-else>
                Er werden mogelijks automatische e-mails uitgestuurd als die ingesteld stonden.
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss({ force: true })">
                    <span>Sluiten</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { STToolbar } from '@stamhoofd/components';
import { GroupType, RegisterCheckout, RegistrationWithMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted } from 'vue';

const props = withDefaults(
    defineProps<{
        checkout?: RegisterCheckout|null,
        registrations: RegistrationWithMember[]
    }>(),
    {
        checkout: null,
    }
);
const dismiss = useDismiss()

onMounted(() => {
    props.checkout?.clear()
})

const names = Formatter.uniqueArray(props.registrations.filter(r => r.group.type !== GroupType.WaitingList).map(r => r.member.firstName ?? "?"))
const waitingListNames = Formatter.uniqueArray(props.registrations.filter(r => r.group.type === GroupType.WaitingList).map(r => r.member.firstName ?? "?"))

const title = computed(() => {
    let t = "Hoera! "

    if (names.length > 0) {
        if (names.length > 3) {
            t += Formatter.joinLast([...names.slice(0, 2), (names.length - 2) + ' andere leden'], ', ', ' en ')+" zijn ingeschreven"
        } else if (names.length > 1) {
            t += Formatter.joinLast(names, ', ', ' en ')+" zijn ingeschreven"
        } else {
            t += names.join('')+" is ingeschreven"
        }
    }

    if (waitingListNames.length > 0) {
        if (names.length > 0) {
            t += " en "
        }

        if (waitingListNames.length > 3) {
            t += Formatter.joinLast([...waitingListNames.slice(0, 2), (waitingListNames.length - 2) + ' andere leden'], ', ', ' en ')+" zijn ingeschreven op de wachtlijst"
        } else if (waitingListNames.length > 1) {
            t += Formatter.joinLast(waitingListNames, ', ', ' en ')+" zijn ingeschreven op de wachtlijst"
        } else {
            t += waitingListNames.join('')+" is ingeschreven op de wachtlijst"
        }
    }
    return t
});

</script>

