import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import type { Event, Group, MemberWithUsersRegistrationsAndGroups, Organization, User } from '@stamhoofd/models';
import type { AccessRight, MemberWithRegistrationsBlob, PermissionLevel, Platform as PlatformStruct } from '@stamhoofd/structures';
import { AdminPermissionChecker } from './AdminPermissionChecker.js';

/**
 * Every method of AdminPermissionChecker that answers "is this allowed" with a boolean.
 */
type PermissionCheck = {
    [K in keyof AdminPermissionChecker]: AdminPermissionChecker[K] extends (...args: any[]) => boolean | Promise<boolean> ? K : never;
}[keyof AdminPermissionChecker];

type BooleanCheck = (...args: unknown[]) => boolean | Promise<boolean>;

/**
 * Checks that are additionally narrowed to what the impersonated user may reach.
 *
 * Being in this list only ever *removes* access: the answer is the administrator's answer
 * AND the impersonated user's. The list exists for faithfulness - an administrator that
 * looks through somebody's eyes should see what that person sees, not more - so leaving a
 * check out of it cannot hand out access the administrator doesn't already have.
 */
export const DUAL_CHECKED_PERMISSIONS: PermissionCheck[] = [
    'canAccess',
    'canAccessAllMembers',
    'canAccessAllPlatformMembers',
    'canAccessArchivedGroups',
    'canAccessBalanceItems',
    'canAccessDocument',
    'canAccessDocumentTemplate',
    'canAccessEmail',
    'canAccessEmailBounces',
    'canAccessEmailTemplate',
    'canAccessEvent',
    'canAccessEventNotification',
    'canAccessGroup',
    'canAccessGroupsInPeriod',
    'canAccessMember',
    'canAccessOrder',
    'canAccessPayment',
    'canAccessPayments',
    'canAccessPrivateOrganizationData',
    'canAccessRecordCategory',
    'canAccessRegistration',
    'canAccessUser',
    'canAccessWebshop',
    'canAccessWebshopTickets',
    'canActivatePackages',
    'canCreateGroupInCategory',
    'canCreateWebshops',
    'canDeactivatePackages',
    'canDeleteMember',
    'canEditUserEmail',
    'canEditUserName',
    'canLinkBalanceItemToMember',
    'canLinkBalanceItemToUser',
    'canManageAdmins',
    'canManageDocuments',
    'canManageFinances',
    'canManageOrganizationDomain',
    'canManageOrganizationSettings',
    'canManagePaymentAccounts',
    'canManagePayments',
    'canManagePlatformAdmins',
    'canManageSSOSettings',
    'canReadAllEmails',
    'canReadEmailTemplates',
    'canReadEmails',
    'canRegisterMembersInGroup',
    'canReviewEventNotification',
    'canSendEmail',
    'canSendEmails',
    'canSendEmailsFrom',
    'canUpload',
    'hasFinancialMemberAccess',
    'hasFullAccess',
    'hasFullAccessForOrganizationResources',
    'hasNRNAccess',
    'hasPlatformFullAccess',
    'hasSomeAccess',
    'hasSomePlatformAccess',
];

/**
 * The permissions of a session that impersonates another user.
 *
 * This *is* the administrator's checker: it inherits from AdminPermissionChecker with the
 * administrator as its user, so anything that is not handled below is answered with the
 * administrator's own rights. That is the safe default, and it is what keeps this class
 * correct when AdminPermissionChecker grows a check that nobody thought about here: a new
 * check can make an impersonated session see too little, never too much.
 *
 * On top of that default, the checks in DUAL_CHECKED_PERMISSIONS are narrowed to what the
 * impersonated user may reach as well, so the session shows what that user would see.
 *
 * The two answers are computed by two separate plain checkers on purpose. Answering both
 * from a single checker would also apply the administrator's answer to the *inner* steps
 * of a check, and an administrator is for instance never the user manager of the member
 * they are looking at - which would leave the impersonated user unable to see their own
 * family.
 */
export class ImpersonatedPermissionChecker extends AdminPermissionChecker {
    /**
     * The account the session presents itself as.
     */
    private readonly impersonated: AdminPermissionChecker;

    /**
     * The account that is really acting, and the ceiling of what this session can do.
     */
    private readonly actor: AdminPermissionChecker;

    constructor(impersonatedUser: User, actor: User, platform: PlatformStruct, organization?: Organization) {
        // Deliberately the administrator: everything that is not narrowed below falls back
        // to their rights.
        super(actor, platform, organization);

        this.impersonated = new AdminPermissionChecker(impersonatedUser, platform, organization);
        this.actor = new AdminPermissionChecker(actor, platform, organization);

        for (const name of DUAL_CHECKED_PERMISSIONS) {
            const asImpersonated = this.impersonated[name] as unknown as BooleanCheck;
            const asActor = this.actor[name] as unknown as BooleanCheck;

            (this as Record<string, unknown>)[name] = (...args: unknown[]) => {
                const first = asImpersonated.apply(this.impersonated, args);

                if (typeof first === 'boolean') {
                    return first ? asActor.apply(this.actor, args) : false;
                }

                return first.then(async result => result ? await asActor.apply(this.actor, args) : false);
            };
        }
    }

    cacheGroup(group: Group) {
        super.cacheGroup(group);
        this.impersonated.cacheGroup(group);
        this.actor.cacheGroup(group);
    }

    /**
     * Throws when the event may not be written, so both accounts have to accept it.
     */
    async checkEventAccess(event: Event): Promise<Organization | null> {
        await this.actor.checkEventAccess(event);
        return await this.impersonated.checkEventAccess(event);
    }

    /**
     * Answers with a set of organizations instead of a yes or no, and the result is used to
     * build database filters: it has to be narrowed to what both accounts can reach.
     */
    getPlatformAccessibleOrganizationTags(level: PermissionLevel): string[] | 'all' {
        return intersectTags(
            this.impersonated.getPlatformAccessibleOrganizationTags(level),
            this.actor.getPlatformAccessibleOrganizationTags(level),
        );
    }

    getOrganizationTagsWithAccessRight(right: AccessRight): string[] | 'all' {
        return intersectTags(
            this.impersonated.getOrganizationTagsWithAccessRight(right),
            this.actor.getOrganizationTagsWithAccessRight(right),
        );
    }

    async canFilterMembersOnRecordId(recordId: string) {
        const result = await this.impersonated.canFilterMembersOnRecordId(recordId);
        if (!result.canAccess) {
            return result;
        }

        if (!(await this.actor.canFilterMembersOnRecordId(recordId)).canAccess) {
            return { canAccess: false as const, record: result.record };
        }
        return result;
    }

    /**
     * Redacts what neither account may see: the impersonated user decides what the session
     * is shown, and the administrator's own redaction is applied on top of it.
     *
     * Running only one of them would be wrong in both directions. As the administrator
     * alone, a parent would not recognise their own family; as the impersonated user alone,
     * an administrator would read the national register numbers, security codes and
     * financial data of a family they may only reach through a single group - the user
     * manager shortcut in filterMemberData skips exactly those checks.
     */
    async filterMemberData(member: MemberWithUsersRegistrationsAndGroups, data: MemberWithRegistrationsBlob, options?: { forAdminCartCalculation?: boolean }): Promise<MemberWithRegistrationsBlob> {
        return await this.actor.filterMemberData(
            member,
            await this.impersonated.filterMemberData(member, data, options),
            options,
        );
    }

    /**
     * A change has to be one both accounts are allowed to make. Both passes strip what may
     * not be written and throw on what may not be attempted at all.
     */
    async filterMemberPatch(member: MemberWithUsersRegistrationsAndGroups, data: AutoEncoderPatchType<MemberWithRegistrationsBlob>): Promise<AutoEncoderPatchType<MemberWithRegistrationsBlob>> {
        return await this.actor.filterMemberPatch(
            member,
            await this.impersonated.filterMemberPatch(member, data),
        );
    }

    /**
     * Creating a member and registering it afterwards spans two requests, so the access
     * that bridges them is granted to both accounts: the second request is checked as both
     * of them again.
     */
    async temporarilyGrantMemberAccess(member: MemberWithUsersRegistrationsAndGroups, permissionLevel?: PermissionLevel) {
        await this.impersonated.temporarilyGrantMemberAccess(member, permissionLevel);
        await this.actor.temporarilyGrantMemberAccess(member, permissionLevel);
    }
}

function intersectTags(a: string[] | 'all', b: string[] | 'all'): string[] | 'all' {
    if (a === 'all') {
        return b;
    }
    if (b === 'all') {
        return a;
    }
    return a.filter(tag => b.includes(tag));
}
