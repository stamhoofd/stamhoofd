import { ArrayDecoder, Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { SessionContext, Storage } from '@stamhoofd/networking';
import { BalanceItem, DetailedPayableBalanceCollection, Document as DocumentStruct, Group, IDRegisterCheckout, LimitedFilteredRequest, MembersBlob, Organization, PaginatedResponseDecoder, Platform, PlatformFamily, Version } from '@stamhoofd/structures';
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

    async loadGroups(organizationId: string, groupIds: string[], { owner, shouldRetry }: { owner?: any; shouldRetry?: boolean } = {}) {
        if (groupIds.length === 0) {
            return [];
        }

        const response = await this.$context.getAuthenticatedServerForOrganization(organizationId).request({
            method: 'GET',
            path: '/groups',
            query: new LimitedFilteredRequest({
                limit: groupIds.length,
                filter: {
                    id: {
                        $in: groupIds,
                    },
                },
            }),
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(Group as Decoder<Group>), LimitedFilteredRequest),
            owner,
            shouldRetry: shouldRetry ?? false,
        });

        return response.data.results;
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

                const organizationId = idCheckout.organizationId;
                if (!organizationId) {
                    // Can't load this checkout
                    return;
                }

                let organization = this.$context.organization ?? this.family.organizations.find(o => o.id === organizationId);
                if (!organization) {
                    // Load organization by id
                    const server = this.$context.getAuthenticatedServerForOrganization(organizationId);
                    const response = await server.request({
                        method: 'GET',
                        path: '/organization',
                        decoder: Organization as Decoder<Organization>,
                        shouldRetry: true,
                    });
                    organization = response.data;
                }

                if (!organization) {
                    return;
                }

                if (organization.id !== organizationId) {
                    // Wrong scope
                    return;
                }

                const knownGroups = organization.period.groups;
                const requestGroupIds = groupIds.filter(id => !knownGroups.some(g => g.id === id));

                const groups = await this.loadGroups(organizationId, requestGroupIds, {
                    owner: {},
                    shouldRetry: true,
                });

                const checkout = idCheckout.hydrate({
                    members: this.family.members,
                    groups: [...knownGroups, ...groups],
                    organizations: [organization],
                });

                try {
                    let balanceItems: BalanceItem[] = [];
                    if (checkout.cart.balanceItems.length) {
                        const response = await this.$context.authenticatedServer.request({
                            method: 'GET',
                            path: `/user/payable-balance/detailed`,
                            decoder: DetailedPayableBalanceCollection as Decoder<DetailedPayableBalanceCollection>,
                            shouldRetry: true,
                            owner: this,
                            timeout: 60 * 1000,
                        });

                        const payableBalanceCollection = response.data;
                        balanceItems = payableBalanceCollection.organizations.flatMap(o => o.balanceItems);
                    }
                    else {
                        console.log('No balance items in cart');
                    }

                    console.log('Validating checkout');
                    checkout.validate({
                        memberBalanceItems: balanceItems,
                    });
                }
                catch (e) {
                    // Invalid cehckout
                    console.error('Error validating checkout', e);
                }

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
        blob.markReceivedFromBackend();
        this.family.insertFromBlob(blob, true);

        if (this.$context.user) {
            this.$context.user.members = blob;
        }
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
