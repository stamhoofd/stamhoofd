<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="group.organizationId" @update="setOrganization">
        <SaveView save-text="Bevestigen" :save-badge="cartLength" :disabled="cartLength === 0" title="Inschrijvingen wijzigen" :loading="saving" @save="goToCheckout">
            <p v-if="!checkout.isAdminFromSameOrganization" class="style-title-prefix">
                {{ groupOrganization!.name }}
            </p>
            <h1>Inschrijvingen voor {{ group.settings.name }} wijzigen</h1>

            <p v-if="checkout.totalPrice && checkout.isAdminFromSameOrganization" class="info-box">
                De kosten zullen aan het openstaande bedrag van elk lid worden toegevoegd. Leden kunnen dit betalen via het ledenportaal.
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />
            
            <STList>
                <DeleteRegistrationRow v-for="registration in checkout.cart.deleteRegistrations" :key="registration.id" class="right-stack" :registration="registration" :checkout="checkout"  />
                <RegisterItemRow v-for="item in checkout.cart.items" :key="item.id" class="right-stack" :item="item" :show-group="false" />
            </STList>
            
            <p v-if="checkout.cart.isEmpty" class="info-box">
                Voeg de leden toe die je wilt inschrijven
            </p>

            <p class="style-button-bar">
                <button type="button" class="button text" @click="searchMembers">
                    <span class="icon search" />
                    <span>Zoek bestaande leden</span>
                </button>

                <button type="button" class="button text" @click="addMember">
                    <span class="icon add" />
                    <span>Splinternieuw lid</span>
                </button>
            </p>

            <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" v-if="!checkout.isAdminFromSameOrganization" />
        </SaveView>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox, ExternalOrganizationContainer, PriceBreakdownBox, STErrorsDefault, useErrors } from '@stamhoofd/components';
import { Group, Organization, PlatformFamily, PlatformMember, RegisterCheckout } from '@stamhoofd/structures';
import { computed, markRaw, onMounted, reactive, ref } from 'vue';
import { EditMemberGeneralBox, MemberStepView, startCheckout } from '.';
import { useContext, useOrganization, usePlatform } from '../hooks';
import { NavigationActions, useNavigationActions } from '../types/NavigationActions';
import RegisterItemRow from './components/group/RegisterItemRow.vue';
import DeleteRegistrationRow from './components/group/DeleteRegistrationRow.vue';
import SearchOrganizationMembersForGroupView from './SearchOrganizationMembersForGroupView.vue';

const props = defineProps<{
    members: PlatformMember[]
    group: Group
    checkout: RegisterCheckout, // we should auto assign this checkout to all search results and newly created members
}>();

function setOrganization(groupOrganization: Organization) {
    props.checkout.setDefaultOrganization(groupOrganization)
}

onMounted(() => {
    // Initially show errors as soon as it is possible
    try {
        props.checkout.validate({})
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
})

const context = useContext();
const contextOrganization = useOrganization()
const platform = usePlatform();
const present = usePresent()
const navigate = useNavigationActions();
const errors = useErrors();
const saving = ref(false)
const cartLength = computed(() => props.checkout.cart.count)

async function addMember() {
    const family = new PlatformFamily({
        contextOrganization: contextOrganization.value,
        platform: platform.value
    })
    family.checkout = props.checkout
    const member = reactive(family.newMember() as any) as PlatformMember
    
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(MemberStepView, {
            title: 'Nieuw lid',
            member,
            component: markRaw(EditMemberGeneralBox), // Only this step, because it could be a reused member
            doSave: true,
            saveHandler: async (navigate: NavigationActions) => {
                await navigate.dismiss({force: true})
                props.members.push(member)

                // todo: wire up views to check member information
            }
        }),
    });
    
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    });
}

async function searchMembers() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(SearchOrganizationMembersForGroupView, {
                    ...props,
                    saveHandler: async (navigate: NavigationActions) => {
                        await navigate.dismiss({force: true})
                    }
                })
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function goToCheckout() {
    if (saving.value) {
        return
    }

    saving.value = true
    try {
        await startCheckout({
            admin: true,
            checkout: props.checkout,
            context: context.value,
            displayOptions: {action: 'show'}
        }, navigate)
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    } finally {
        saving.value = false
    }
}

</script>
