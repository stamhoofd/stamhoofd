import { ArrayDecoder, AutoEncoderPatchType, Decoder, deepSetArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { GlobalEventBus } from '@stamhoofd/components';
import { LoginHelper, SessionContext, SessionManager } from '@stamhoofd/networking';
import { Group, LimitedFilteredRequest, Organization, OrganizationAdmins, OrganizationRegistrationPeriod, PaginatedResponseDecoder, RegistrationPeriod, RegistrationPeriodList, SortItemDirection } from '@stamhoofd/structures';
import { Ref, inject, toRef } from 'vue';

export function useOrganizationManager(): Ref<OrganizationManager> {
    return toRef(inject<OrganizationManager>('$organizationManager')) as any as Ref<OrganizationManager>;
}

/**
 * Convenient access to the organization of the current session.
 *
 * Note: this is bad practice and we should replace this with hooks as much as possible in the future.
 */
export class OrganizationManager {
    $context: SessionContext;

    constructor($context: SessionContext) {
        // Make reactive
        this.$context = $context;
    }

    get organization() {
        return this.$context.organization!;
    }

    set organization(organization: Organization) {
        this.$context.updateOrganization(organization);
    }

    get user() {
        return this.$context.user!;
    }

    getPatch() {
        return Organization.patch({
            id: this.organization.id,
        });
    }

    async forceUpdate() {
        await this.$context.fetchOrganization(false);
    }

    async patch(patch: AutoEncoderPatchType<Organization>, options: { shouldRetry?: boolean; owner?: any } = {}) {
        if (!this.$context.organization) {
            throw new SimpleError({
                code: 'no_organization',
                message: 'No organization loaded',
            });
        }

        patch.id = this.$context.organization.id;

        const response = await this.$context.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization',
            body: patch,
            decoder: Organization as Decoder<Organization>,
            shouldRetry: options.shouldRetry ?? false,
            owner: options.owner,
        });

        // Keep admins
        const admins = this.$context.organization.admins;
        this.$context.updateOrganization(response.data);

        if (admins && !response.data.admins && patch.admins) {
            this.$context.organization.admins = patch.admins.applyTo(admins);
        }

        if (patch.period) {
            // Clear cached periods
            this.$context.organization.periods = undefined;

            // There is something fishy going on with the period that doesn't get set using deepSet (updateOrganization) - can't explain why atm
            // this fixes it for now
            this.$context.organization.period = response.data.period;
        }

        // Call handlers: also update the stored organization in localstorage
        // + handle other listeners
        this.$context.callListeners('organization');

        // Save organization in localstorage
        this.save().catch(console.error);

        await GlobalEventBus.sendEvent('organization-updated', this.$context.organization);
    }

    async loadAdmins(force = false, shouldRetry = true, owner?: any): Promise<OrganizationAdmins> {
        if (!force && this.organization.admins) {
            return this.organization as any;
        }

        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/organization/admins',
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>,
            shouldRetry,
            owner,
        });
        const loaded = response.data;

        if (this.organization.admins) {
            deepSetArray(this.organization.admins, loaded.users);
        }
        else {
            this.organization.admins = loaded.users;
        }

        // Save organization in localstorage
        this.save().catch(console.error);

        return this.organization as any;
    }

    async loadPeriods(force = false, shouldRetry?: boolean, owner?: any) {
        if (!force && this.organization.periods) {
            return this.organization.periods;
        }

        // Load last 5 years
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 6);

        // Improve http caching
        startDate.setDate(1);
        startDate.setMonth(0);
        startDate.setHours(0, 0, 0, 0);

        // Load periods
        const periodsResponse = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/registration-periods',
            query: new LimitedFilteredRequest({
                filter: {
                    startDate: {
                        $gt: startDate,
                    },
                },
                limit: 10,
                sort: [
                    {
                        key: 'startDate',
                        order: SortItemDirection.DESC,
                    },
                    {
                        key: 'id',
                        order: SortItemDirection.ASC,
                    },
                ],
            }),
            decoder: new PaginatedResponseDecoder(
                new ArrayDecoder(RegistrationPeriod as Decoder<RegistrationPeriod>),
                LimitedFilteredRequest,
            ),
            owner,
            shouldRetry: shouldRetry ?? false,
        });

        const periods = periodsResponse.data.results;
        let organizationPeriods: OrganizationRegistrationPeriod[] = [];

        if (periods.length !== 0) {
            const response = await this.$context.authenticatedServer.request({
                method: 'GET',
                path: '/organization/registration-periods',
                query: new LimitedFilteredRequest({
                    filter: {
                        periodId: {
                            $in: periods.map(p => p.id),
                        },
                    },
                    limit: 20,
                    sort: [
                        {
                            key: 'id',
                            order: SortItemDirection.ASC,
                        },
                    ],
                }),
                decoder: new PaginatedResponseDecoder(
                    new ArrayDecoder(OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>),
                    LimitedFilteredRequest,
                ),
                owner,
                shouldRetry: shouldRetry ?? false,
            });
            organizationPeriods = response.data.results;
        }

        const list = RegistrationPeriodList.create({
            organizationPeriods: organizationPeriods,
            periods: periods,
        });

        if (this.organization.periods) {
            this.organization.periods?.deepSet(list);
        }
        else {
            this.organization.periods = list;
        }

        return list;
    }

    async loadArchivedGroups({ owner }: { owner?: any }) {
        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: '/organization/archived-groups',
            decoder: new ArrayDecoder(Group as Decoder<Group>),
            owner,
        });

        return response.data.sort((a, b) => b.settings.endDate.getTime() - a.settings.endDate.getTime());
    }

    /**
     * Save organization in localstorage
     */
    async save() {
        // Save organization in localstorage
        if (this.$context.organization) {
            await SessionManager.addOrganizationToStorage(this.$context.organization);
        }
    }
}
