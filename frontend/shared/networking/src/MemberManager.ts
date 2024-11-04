import { ArrayDecoder, Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { SessionContext, Storage } from '@stamhoofd/networking';
import { Document as DocumentStruct, GroupsWithOrganizations, IDRegisterCheckout, MembersBlob, Platform, PlatformFamily, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { inject, reactive, watch } from 'vue';

export function useMemberManager() {
    return inject<MemberManager>('$memberManager', null as unknown as MemberManager) as MemberManager;
}

/**
 * Controls the fetching and decrypting of members
 */
export class MemberManager {
    /// Currently saved members
    $context: SessionContext;
    family: PlatformFamily;

    _unwatch: any;
    _unwatchUser: any;

    constructor($context: SessionContext, platform: Platform) {
        this.$context = $context;
        this.family = reactive(
            new PlatformFamily({
                contextOrganization: $context.organization,
                platform,
            }) as any,
        ) as PlatformFamily;
        this.watchCheckout();
        this.watchUser();

        // Reactive hack: always force creating reactive MemberManager
        return reactive(this) as unknown as MemberManager;
    }

    watchUser() {
        if (this._unwatchUser) {
            this._unwatchUser();
        }

        // If the user is refetched, also reload the members that we've received
        let lastUpdatedAt = new Date(0);
        this._unwatchUser = watch(() => this.$context.user, () => {
            if (this.$context._lastFetchedUser && this.$context._lastFetchedUser > lastUpdatedAt) {
                if (this.$context.user && this.$context.user.members && !this.$context.user.members.isStale) {
                    lastUpdatedAt = new Date();
                    this.loadMembers().catch(console.error);
                }
            }
        }, { deep: true });
    }

    watchCheckout() {
        if (this._unwatch) {
            this._unwatch();
        }

        this._unwatch = watch(() => this.family.checkout, () => {
            this.saveCheckout().catch(console.error);
        }, { deep: true });
    }

    async loadGroupsById(groupIds: string[], skipOrganizationIds: string[] = [], { owner, shouldRetry }: { owner?: any; shouldRetry?: boolean } = {}) {
        if (groupIds.length === 0) {
            return GroupsWithOrganizations.create({
                groups: [],
                organizations: [],
            });
        }

        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/groups',
            query: {
                ids: groupIds.join(','),
                excludeOrganizationIds: skipOrganizationIds.length ? Formatter.uniqueArray(skipOrganizationIds).join(',') : undefined,
            },
            decoder: GroupsWithOrganizations as Decoder<GroupsWithOrganizations>,
            owner,
            shouldRetry: shouldRetry ?? false,
        });

        return response.data;
    }

    get storageKey() {
        return 'register_checkout_' + (STAMHOOFD.userMode === 'platform' ? 'platform' : (this.$context.organization?.id ?? 'platform'));
    }

    async loadCheckout() {
        console.log('Loading checkout');

        try {
            // Note: we should always use the platform one for platforms, since the focused organization isn't a hard requirement
            const storedData = await Storage.keyValue.getItem(this.storageKey);
            if (storedData) {
                const json = JSON.parse(storedData);
                const data = new ObjectData(json, { version: 0 });
                const decoder = new VersionBoxDecoder(IDRegisterCheckout as Decoder<IDRegisterCheckout>);
                const idCheckout = data.decode(decoder).data;

                const groupIds = idCheckout.groupIds;

                const knownGroups = this.family.organizations.flatMap(o => o.period.groups);
                const requestGroupIds = groupIds.filter(id => !knownGroups.some(g => g.id == id));

                const groupsWithOrganizations = await this.loadGroupsById(requestGroupIds, this.family.organizations.map(o => o.id), {
                    owner: {},
                    shouldRetry: true,
                });

                const checkout = idCheckout.hydrate({
                    members: this.family.members,
                    groups: [...knownGroups, ...groupsWithOrganizations.groups],
                    organizations: [...this.family.organizations, ...groupsWithOrganizations.organizations],
                });

                this.family.checkout = checkout;
                this.watchCheckout();
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    async saveCheckout() {
        console.log('Saving checkout');
        try {
            const versionBox = new VersionBox(this.family.checkout.convert());
            const encoded = JSON.stringify(versionBox.encode({ version: Version }));
            await Storage.keyValue.setItem(this.storageKey, encoded);
        }
        catch (e) {
            console.error(e);
        }
    }

    get isAcceptingNewMembers() {
        return STAMHOOFD.userMode === 'platform' ? true : (this.$context.organization?.isAcceptingNewMembers(this.$context.hasPermissions()) ?? true);
    }

    async loadMembers() {
        console.log('MemberManager.loadMembers');
        if (this.$context.user?.members && !this.$context.user.members.isStale) {
            this.family.insertFromBlob(this.$context.user.members, true);
            return;
        }

        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/user/members',
            decoder: MembersBlob as Decoder<MembersBlob>,
        });
        const blob = response.data;
        this.family.insertFromBlob(blob, true);
    }

    async loadDocuments() {
        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/documents',
            decoder: new ArrayDecoder(DocumentStruct as Decoder<DocumentStruct>),
        });

        this.family.setDocuments(response.data);
    }
}
