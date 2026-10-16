import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Group, Organization, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import type { DisplayOptions, NavigationActions } from '#types/NavigationActions.ts';

export type RegisterItemCheckoutOptions = {
    item: RegisterItem;
    navigate: NavigationActions;
    context: SessionContext;
    admin?: boolean;
    displayOptions?: DisplayOptions;
    startCheckoutFlow?: boolean;
    finishHandler?: () => Promise<void> | void;
};

export type DefaultRegisterItemOptions = {
    group: Group;
    member: PlatformMember;
    groupOrganization?: Organization;
    context: SessionContext;
    owner?: any;
};

export type ChooseGroupForMemberOptions = {
    admin?: boolean;
    member: PlatformMember;
    navigate: NavigationActions;
    context: SessionContext;
    displayOptions?: DisplayOptions;
    startCheckoutFlow?: boolean;
    defaultOrganization?: Organization;
};

export type RegisterItemCheckoutHandler = (options: RegisterItemCheckoutOptions) => Promise<void>;
export type DefaultRegisterItemHandler = (options: DefaultRegisterItemOptions) => Promise<RegisterItem | undefined>;
export type ChooseGroupForMemberHandler = (options: ChooseGroupForMemberOptions) => Promise<void>;
