export enum EmailRecipientFilterType {
    RegistrationMembers = 'RegistrationMembers',
    RegistrationParents = 'RegistrationParents',
    RegistrationUnverified = 'RegistrationUnverified',

    Members = 'Members',
    MemberParents = 'MemberParents',
    MemberUnverified = 'MemberUnverified',
    Orders = 'Orders',
    ReceivableBalances = 'ReceivableBalances',
    Documents = 'Documents',
    Organizations = 'Organizations',

    // These naming should have been in plural:
    // Please don't add new enum values not in plural.
    Payment = 'Payment',
    PaymentOrganization = 'PaymentOrganization',
}
