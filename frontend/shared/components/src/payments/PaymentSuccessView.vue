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
    let t = $t(`%1Tf`) ;
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
        t = $t('%1Rc')
        d = $t('%1Qo')
    }

    if (registrationNames.size) {
        if (registrationNamesPerGroup.size === 1) {
            if (registrationNames.size > 4) {
                t = $t('%1RL', {
                    'count': registrationNames.size,
                    group: [...registrationNamesPerGroup.keys()].join()
                })
            } else if (registrationNames.size > 1) {
                t = $t('%1Qm', {
                    'simon-and-sarah': Formatter.joinLast([...registrationNames.values()], ', ', ' ' + $t('%M1') + ' '),
                    group: [...registrationNamesPerGroup.keys()].join()
                })
            } else {
                t = $t('%1TR', {
                    'simon': [...registrationNames.values()].join(),
                    group: [...registrationNamesPerGroup.keys()].join()
                })
            }
        } else {
            if (registrationNames.size > 4) {
                t = $t('%1Sy', {
                    'count': registrationNames.size,
                })
            } else if (registrationNames.size > 1) {
                t = $t('%1RR', {
                    'simon-and-sarah': Formatter.joinLast([...registrationNames.values()], ', ', ' ' + $t('%M1') + ' '),
                })
            } else {
                t = $t('%1UF', {
                    'simon': [...registrationNames.values()].join(),
                })
            }
        }
    }

    if (membershipNames.size) {
        if (membershipNamesPerGroup.size === 1) {
            if (membershipNames.size > 4) {
                t = $t('%1Rs', {
                    'count': membershipNames.size,
                    name: [...membershipNamesPerGroup.keys()].join()
                })
            } else if (membershipNames.size > 1) {
                t = $t('%1TL', {
                    'simon-and-sarah': Formatter.joinLast([...membershipNames.values()], ', ', ' ' + $t('%M1') + ' '),
                    name: [...membershipNamesPerGroup.keys()].join()
                })
            } else {
                t = $t('%1SY', {
                    'simon': [...membershipNames.values()].join(),
                    name: [...membershipNamesPerGroup.keys()].join()
                })
            }
        } else {
            if (membershipNames.size > 4) {
                t = $t('%1Sy', {
                    'count': membershipNames.size,
                })
            } else if (membershipNames.size > 1) {
                t = $t('%1RR', {
                    'simon-and-sarah': Formatter.joinLast([...membershipNames.values()], ', ', ' ' + $t('%M1') + ' '),
                })
            } else {
                t = $t('%1UF', {
                    'simon': [...membershipNames.values()].join(),
                })
            }
        }
    }

    if (others && !d) {
        if (others> 1) {
            d = $t('%1Tz', {count: Formatter.integer(others)})
        } else {
            d = $t('%1SF', {count: Formatter.integer(others)})
        }
    }
    

    return {title: t, description: d}
})();

</script>
