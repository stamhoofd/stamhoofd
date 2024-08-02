<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="group.organizationId" @update="setOrganization">
        <SaveView save-text="Inschrijven" :save-badge="cartLength" :disabled="cartLength === 0">
            <p v-if="!checkout.isAdminFromSameOrganization" class="style-title-prefix">
                {{ groupOrganization!.name }}
            </p>
            <h1>Kies leden die je wilt inschrijven voor {{ group.settings.name }}</h1>

            <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
            </form>

            <STList>
                <MemberRegisterItemCheckboxRow
                    v-for="member in fetcher.objects" 
                    :key="member.id" 
                    :member="member" 
                    :group="group" 
                    :group-organization="groupOrganization" 
                />
                <MemberRegisterItemCheckboxRow
                    v-for="member in calculatedMembers" 
                    :key="member.id" 
                    :member="member" 
                    :group="group" 
                    :group-organization="groupOrganization" 
                />
            </STList>

            <InfiniteObjectFetcherEnd empty-message="Geen leden gevonden" :fetcher="fetcher" />


            <p class="style-button-bar">
                <button type="button" class="button text" @click="addMember">
                    <span class="icon add" />
                    <span>Nieuw lid toevoegen</span>
                </button>
            </p>
        </SaveView>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ExternalOrganizationContainer, InfiniteObjectFetcherEnd, useInfiniteObjectFetcher } from '@stamhoofd/components';
import { assertSort, Group, LimitedFilteredRequest, MembersBlob, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, RegisterCheckout, SortItemDirection, SortList } from '@stamhoofd/structures';
import { computed, markRaw, reactive, ref, watchEffect } from 'vue';
import { EditMemberGeneralBox, MemberStepView } from '.';
import { useContext, useOrganization, usePlatform } from '../hooks';
import { NavigationActions } from '../types/NavigationActions';
import MemberRegisterItemCheckboxRow from './components/group/MemberRegisterItemCheckboxRow.vue';

type ObjectType = PlatformMember;

const props = defineProps<{
    members: PlatformMember[]
    group: Group
    checkout: RegisterCheckout, // we should auto assign this checkout to all search results and newly created members
}>();

function setOrganization(groupOrganization: Organization) {
    props.checkout.setDefaultOrganization(groupOrganization)
}

const searchQuery = ref('');
const context = useContext();
const contextOrganization = useOrganization()
const platform = usePlatform();
const present = usePresent()
const calculatedMembers = computed(() => {
    const base = new Set(props.members)
    for (const item of props.checkout.cart.items) {
        base.add(item.member)
    }
    return Array.from(base)
});
const cartLength = computed(() => props.checkout.cart.items.length)

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
            component: markRaw(EditMemberGeneralBox),
            doSave: true,
            saveHandler: async (navigate: NavigationActions) => {
                await navigate.dismiss({force: true})
                props.members.push(member)

                // if (props.group && organization.value && props.group.organizationId === organization.value.id) {
                //     await checkoutDefaultItem({
                //         group: props.group,
                //         member,
                //         organization: organization.value,
                //         admin: true
                //     })
                // } else {
                //     await chooseGroupForMember({
                //         member
                //     })
                // }
            }
        }),
    });
    
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    });
}

function extendSort(list: SortList): SortList  {
    return assertSort(list, [
        {key: "birthDay", order: SortItemDirection.ASC},
        {key: "id"}
    ])
}

const fetcher = useInfiniteObjectFetcher<ObjectType>({
    get requiredFilter() {
        if (!contextOrganization.value) {
            throw new Error("Organization is required")
        }
        return {
            registrations: {
                $elemMatch: {
                    organization: {
                        id: contextOrganization.value.id
                    },
                }
            }
        };
    },
    async fetch(data: LimitedFilteredRequest): Promise<{results: ObjectType[], next?: LimitedFilteredRequest}> {
        console.log('Members.fetch', data);
        data.sort = extendSort(data.sort);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/members",
            decoder: new PaginatedResponseDecoder(MembersBlob as Decoder<MembersBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        });

        console.log('[Done] Members.fetch', data, response.data);

        const blob = response.data.results;

        const results = PlatformFamily.createSingles(blob, {
            contextOrganization: context.value.organization,
            platform: platform.value
        })

        for (const result of results) {
            result.family.checkout = props.checkout
        }
        
        return {
            results,
            next: response.data.next
        }
    },

    async fetchCount(): Promise<number> {
        throw new Error("Method not implemented.");
    }
})

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value)
})

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur()
}

</script>
