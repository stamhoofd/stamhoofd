<template>
    <div class="st-view" data-testid="payment-success-view">
        <STNavigationBar :title="title" />
        <main>
            <h1>{{ title }}</h1>

            <p v-text="description" />
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
import { useContext } from '#hooks/useContext.ts';
import STToolbar from '#navigation/STToolbar.vue';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { useMemberManager } from '@stamhoofd/networking/MemberManager';
import type { PaymentGeneral } from '@stamhoofd/structures';
import { BalanceItemRelationType, BalanceItemType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { onMounted } from 'vue';
import { GlobalEventBus } from '../EventBus';

// We only pass in the payment for compatibility with URL handling
const props = defineProps<{
    payment: PaymentGeneral;
}>();

const dismiss = useDismiss();
const context = useContext();
const memberManager = useMemberManager();

onMounted(() => {
    memberManager.family.checkout.clear();
    
    // Force reload organization
    context.value.updateData(true, false, false).catch(console.error);
    GlobalEventBus.sendEvent('payment-succeeded', props.payment).catch(console.error)
});

const {title, description} = (() => {
    let t = $t(`Betaling gelukt!`) ;
    let d = '';

    let packages = false;
    let others = 0;
    const registrationNames: Set<string> = new Set()
    const registrationNamesPerGroup: Map<string, string[]> = new Map();
    
    const membershipNames: Set<string> = new Set()
    const membershipNamesPerGroup: Map<string, string[]> = new Map();

    function addRegistration(group: string | undefined, name: string | undefined) {
        if (!name) {
            return;
        }
        registrationNames.add(name)

        if (!group) {
            return;
        }

        let l = registrationNamesPerGroup.get(group);
        if (!l) {
            l = [];
            registrationNamesPerGroup.set(group, l)
        }
        l.push(name)
    }

    function addMembership(group: string | undefined, name: string | undefined) {
        if (!name) {
            return;
        }
        membershipNames.add(name)

        if (!group) {
            return;
        }

        let l = membershipNamesPerGroup.get(group);
        if (!l) {
            l = [];
            membershipNamesPerGroup.set(group, l)
        }
        l.push(name)
    }

    for (const item of props.payment.balanceItemPayments) {
        const i = item.balanceItem;

        if (i.type === BalanceItemType.PlatformMembership) {
            addMembership(i.relations.get(BalanceItemRelationType.MembershipType)?.name.toString(), i.relations.get(BalanceItemRelationType.Member)?.name.toString())
        } else if (i.paidAt && i.paidAt.getTime() < Date.now() - 20_000) {
            // This was paid later - meaning we just paid for something that was already active
            // for packages and regisrations the message should be changed by this
            others++;
        } else if (i.type === BalanceItemType.STPackage) {
            packages = true;
        } else if (i.type === BalanceItemType.Registration) {
            addRegistration(i.relations.get(BalanceItemRelationType.Group)?.name.toString(), i.relations.get(BalanceItemRelationType.Member)?.name.toString())
        } else {
            others++;
        }
    }

    if (packages) {
        t = $t('Gelukt! De pakketten zijn geactiveerd')
        d = $t('Je kan er nu mee aan de slag.')
    }

    if (registrationNames.size) {
        if (registrationNamesPerGroup.size === 1) {
            if (registrationNames.size > 4) {
                t = $t('Hoera! {count} leden werden ingeschreven voor {group}', {
                    'count': registrationNames.size,
                    group: [...registrationNamesPerGroup.keys()].join()
                })
            } else if (registrationNames.size > 1) {
                t = $t('Hoera! {simon-and-sarah} werden ingeschreven voor {group}', {
                    'simon-and-sarah': Formatter.joinLast([...registrationNames.values()], ', ', ' ' + $t('en') + ' '),
                    group: [...registrationNamesPerGroup.keys()].join()
                })
            } else {
                t = $t('Hoera! {simon} werd ingeschreven voor {group}', {
                    'simon': [...registrationNames.values()].join(),
                    group: [...registrationNamesPerGroup.keys()].join()
                })
            }
        } else {
            if (registrationNames.size > 4) {
                t = $t('Hoera! {count} leden werden ingeschreven', {
                    'count': registrationNames.size,
                })
            } else if (registrationNames.size > 1) {
                t = $t('Hoera! {simon-and-sarah} werden ingeschreven', {
                    'simon-and-sarah': Formatter.joinLast([...registrationNames.values()], ', ', ' ' + $t('en') + ' '),
                })
            } else {
                t = $t('Hoera! {simon} werd ingeschreven', {
                    'simon': [...registrationNames.values()].join(),
                })
            }
        }
    }

    if (membershipNames.size) {
        if (membershipNamesPerGroup.size === 1) {
            if (membershipNames.size > 4) {
                t = $t('Hoera! De aansluiting “{name}” voor {count} leden werd betaald', {
                    'count': membershipNames.size,
                    name: [...membershipNamesPerGroup.keys()].join()
                })
            } else if (membershipNames.size > 1) {
                t = $t('Hoera! De aansluiting “{name}” voor {simon-and-sarah} werd betaald', {
                    'simon-and-sarah': Formatter.joinLast([...membershipNames.values()], ', ', ' ' + $t('en') + ' '),
                    name: [...membershipNamesPerGroup.keys()].join()
                })
            } else {
                t = $t('Hoera! De aansluiting “{name}” voor {simon} werd betaald', {
                    'simon': [...membershipNames.values()].join(),
                    name: [...membershipNamesPerGroup.keys()].join()
                })
            }
        } else {
            if (membershipNames.size > 4) {
                t = $t('Hoera! {count} leden werden ingeschreven', {
                    'count': membershipNames.size,
                })
            } else if (membershipNames.size > 1) {
                t = $t('Hoera! {simon-and-sarah} werden ingeschreven', {
                    'simon-and-sarah': Formatter.joinLast([...membershipNames.values()], ', ', ' ' + $t('en') + ' '),
                })
            } else {
                t = $t('Hoera! {simon} werd ingeschreven', {
                    'simon': [...membershipNames.values()].join(),
                })
            }
        }
    }

    if (others && !d) {
        if (others> 1) {
            d = $t('Ook {count} andere items werden betaald', {count: Formatter.integer(others)})
        } else {
            d = $t('Ook één ander item werd betaald', {count: Formatter.integer(others)})
        }
    }
    

    return {title: t, description: d}
})();

</script>
