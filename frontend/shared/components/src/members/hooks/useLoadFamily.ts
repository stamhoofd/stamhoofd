import { Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components';
import { SessionContext, useRequestOwner } from '@stamhoofd/networking';
import { MembersBlob, PlatformMember } from '@stamhoofd/structures';
import { updateContextFromMembersBlob } from '../helpers';

export function useLoadFamilyFromId() {
    const context = useContext();
    const owner = useRequestOwner();

    return (memberId: string, options?: { shouldRetry?: boolean }) => {
        return loadFamilyFromId({ memberId, context: context.value, owner }, options);
    };
}

export function useLoadFamily() {
    const context = useContext();
    const owner = useRequestOwner();

    return (member: PlatformMember, options?: { shouldRetry?: boolean }) => {
        return loadFamily({ member, context: context.value, owner }, options);
    };
}

export async function loadFamilyFromId({ memberId, context, owner }: { memberId: string; context: SessionContext; owner: object }, options?: { shouldRetry?: boolean }) {
    const response = await context.authenticatedServer.request({
        method: 'GET',
        path: `/organization/members/${memberId}/family`,
        decoder: MembersBlob as Decoder<MembersBlob>,
        owner,
        shouldRetry: options?.shouldRetry ?? false,
    });

    response.data.markReceivedFromBackend();

    updateContextFromMembersBlob(context, response.data);
    return response.data;
}

export async function loadFamily({ member, context, owner }: { member: PlatformMember; context: SessionContext; owner: object }, options?: { shouldRetry?: boolean }) {
    const response = await loadFamilyFromId({ memberId: member.id, context, owner }, options);
    member.family._isSingle = false;
    member.family.insertFromBlob(response);
}

export async function loadFamilyIfNeeded(...params: Parameters<typeof loadFamily>) {
    if (params[0].member.family._isSingle) {
        // We only load the family if it is not already loaded
        await loadFamily(...params);
    }
}
