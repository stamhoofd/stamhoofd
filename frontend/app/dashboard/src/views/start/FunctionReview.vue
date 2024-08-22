<template>
    <STListItem>
        <h3 class="style-title-list">
            {{ responsibility.name }}
        </h3>
        <p class="style-description-small">
            {{ memberNames }}
        </p>
    </STListItem>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { useContext, useOrganization, usePlatform } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { LimitedFilteredRequest, MemberResponsibility, MembersBlob, PaginatedResponseDecoder, PlatformFamily, PlatformMember, SortItemDirection } from '@stamhoofd/structures';
import { computed, Ref, ref, watch } from 'vue';

const props = defineProps<{responsibility: MemberResponsibility}>();
const context = useContext();
const owner = useRequestOwner();
const $platform = usePlatform();
const $organization = useOrganization();

const $members = ref(null) as Ref<PlatformMember[] | null>;

const memberNames = computed(() => {
    if (!$members.value?.length) return 'Geen';

    return $members.value.map(m => {
        const member = m.member;
        return member.name;
    }).join(', ')
});

watch(() => props.responsibility, async (responsibility) => {

    const organization = $organization.value;

    if(!organization) return;

    responsibility.clone();

    const query = new LimitedFilteredRequest({
        filter: {
            responsibilities: {
                $elemMatch: {
                    organizationId: organization.id,
                    responsibilityId: responsibility.id,
                    $and: [
                        {
                            $or: [{
                                endDate: {
                                    $gt: { $: '$now' },
                                }
                            }, { endDate: { $eq: null } }]
                        },
                        {
                            $or: [
                                {
                                    startDate: {
                                        $lte: { $: '$now' },
                                    }
                                }, {
                                    startDate: { $eq: null }
                                }
                            ]
                        }
                    ]
                }
            }
        },
        sort: [{ key: 'firstName', order: SortItemDirection.ASC }, { key: 'lastName', order: SortItemDirection.ASC }, { key: 'id', order: SortItemDirection.ASC }],
        limit: 100
    });

    const response = await context.value.authenticatedServer.request({
        method: "GET",
        path: "/members",
        decoder: new PaginatedResponseDecoder(MembersBlob as Decoder<MembersBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
        query,
        shouldRetry: false,
        owner
    });

    const blob = response.data.results;

    const results: PlatformMember[] = PlatformFamily.createSingles(blob, {
        contextOrganization: context.value.organization,
        platform: $platform.value
    });

    $members.value = results;
}, { immediate: true });
</script>
