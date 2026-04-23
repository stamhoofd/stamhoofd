if (typeof window === 'object') {
    if (!(window as any).$t) {
        (window as any).$t = (s: string) => s;
    }
}

if (typeof global === 'object') {
    if (!(global as any).$t) {
        (global as any).$t = (s: string) => s;
    }
}

if (typeof self === 'object') {
    if (!(self as any).$t) {
        (self as any).$t = (s: string) => s;
    }
}

// Latest version of the structures
export { Version } from './Version.js';

export * from './PriceBreakdown.js';

// General
export * from './AppType.js';
export * from './Language.js';
export * from './TranslatedString.js';
export * from './AccessRight.js';
export * from './addresses/Address.js';
export * from './addresses/City.js';
export * from './addresses/CountryDecoder.js';
export * from './addresses/Premise.js';
export * from './addresses/Province.js';
export * from './addresses/SearchRegions.js';
export * from './Company.js';
export * from './DefaultAgeGroup.js';
export * from './Document.js';
export * from './Event.js';
export * from './ReduceablePrice.js';
export * from './EventNotification.js';
export * from './EventNotificationStatus.js';
export * from './EventNotificationType.js';
export * from './GenericBalance.js';
export * from './Group.js';
export * from './GroupCategory.js';
export * from './GroupGenderType.js';
export * from './GroupPrivateSettings.js';
export * from './GroupSettings.js';
export * from './GroupType.js';
export * from './LoginMethod.js';
export * from './MemberResponsibility.js';
export * from './members/MemberPlatformMembership.js';
export * from './members/MemberResponsibilityRecord.js';
export * from './members/PlatformMembership.js';
export * from './members/NationalRegisterNumberOptOut.js';
export * from './OldGroupPrices.js';
export * from './OpenID.js';
export * from './Organization.js';
export * from './OrganizationEmail.js';
export * from './OrganizationGenderType.js';
export * from './OrganizationLevelRecordsConfiguration.js';
export * from './OrganizationMetaData.js';
export * from './OrganizationPrivateMetaData.js';
export * from './OrganizationSimple.js';
export * from './OrganizationType.js';
export * from './PaymentConfiguration.js';
export * from './PaymentCustomer.js';
export * from './PaymentMethod.js';
export * from './PaymentProvider.js';
export * from './PaymentStatus.js';
export * from './PaymentType.js';
export * from './PermissionLevel.js';
export * from './PermissionRole.js';
export * from './Permissions.js';
export * from './PermissionsByRole.js';
export * from './PermissionsResourceType.js';
export * from './Platform.js';
export * from './PlatformServerConfig.js';
export * from './Policy.js';
export * from './ReceivableBalance.js';
export * from './RegisterCodeStatus.js';
export * from './RegistrationPeriod.js';
export * from './RegistrationPeriodBase.js';
export * from './ResourcePermissions.js';
export * from './RichText.js';
export * from './SeatingPlan.js';
export * from './SetupStepReview.js';
export * from './SetupSteps.js';
export * from './SetupStepType.js';
export * from './StockReservation.js';
export * from './StripeAccount.js';
export * from './Token.js';
export * from './UmbrellaOrganization.js';
export * from './User.js';
export * from './BundleDiscount.js';
export * from './BundleDiscountGroupPriceSettings.js';
export * from './GroupPriceDiscount.js';
export * from './members/MembershipStatus.js';
export * from './AppliedRegistrationDiscount.js';
export * from './MemberAdmin.js';
export * from './LoadedPermissions.js';
export * from './UitpasClientCredentialsStatus.js';
export * from './members/UitpasNumberDetails.js';
export * from './getActivePeriods.js';

// UserPermissions
export * from './UserPermissions.js';
export * from './UserWithMembers.js';

// Endpoints
export * from './DNSRecord.js';
export * from './endpoints/ChargeMembershipsSummary.js';
export * from './endpoints/ChargeRequest.js';
export * from './endpoints/CheckMollieResponse.js';
export * from './endpoints/CreateOrganization.js';
export * from './endpoints/EmailRequest.js';
export * from './endpoints/ForgotPasswordRequest.js';
export * from './endpoints/OrganizationAdmins.js';
export * from './endpoints/OrganizationDomains.js';
export * from './endpoints/PayableBalanceCollection.js';
export * from './endpoints/RegisterMember.js';
export * from './endpoints/RegisterResponse.js';
export * from './endpoints/SignupResponse.js';
export * from './endpoints/tokens/ChallengeGrantStruct.js';
export * from './endpoints/tokens/CreateTokenStruct.js';
export * from './endpoints/tokens/PasswordGrantStruct.js';
export * from './endpoints/tokens/PasswordTokenGrantStruct.js';
export * from './endpoints/tokens/RefreshTokenGrantStruct.js';
export * from './endpoints/tokens/RequestChallengeGrantStruct.js';
export * from './endpoints/VerifyEmailRequest.js';
export * from './endpoints/WebshopUriAvailabilityResponse.js';
export * from './endpoints/UitpasPriceCheckRequest.js';
export * from './endpoints/UitpasOrganizersResponse.js';
export * from './endpoints/UitpasEventsResponse.js';
export * from './endpoints/UitpasClientIdAndSecret.js';
export * from './endpoints/UitpasSetClientCredentialsResponse.js';
export * from './endpoints/UitpasNumbersGetDetailsRequest.js';

// email
export * from './email/EditorSmartButton.js';
export * from './email/EditorSmartVariable.js';
export * from './email/Email.js';

// Grouping
export * from './grouping/PaginatedResponse.js';

// Members
export * from './files/File.js';
export * from './files/Image.js';
export * from './files/Resolution.js';
export * from './files/ResolutionRequest.js';
export * from './members/EmergencyContact.js';
export * from './members/Gender.js';
export * from './members/Member.js';
export * from './members/MemberDetails.js';
export * from './members/MemberWithRegistrationsBlob.js';
export * from './members/ObjectWithRecords.js';
export * from './members/OrganizationRecordsConfiguration.js';
export * from './members/Parent.js';
export * from './members/ParentType.js';
export * from './members/Payment.js';
export * from './members/PaymentGeneral.js';
export * from './members/PlatformMember.js';
export * from './members/records/LegacyRecord.js';
export * from './members/records/LegacyRecordType.js';
export * from './members/records/RecordAnswer.js';
export * from './members/records/RecordCategory.js';
export * from './members/records/RecordConfigurationFactory.js';
export * from './members/records/RecordFactory.js';
export * from './members/records/RecordSettings.js';
export * from './members/Registration.js';
export * from './members/RegistrationWithEncryptedMember.js';
export * from './members/RegistrationWithTinyMember.js';
export * from './members/ReviewTime.js';
export * from './members/RegistrationWithMemberBlob.js';
export * from './members/RegistrationsBlob.js';
export * from './members/RegistrationInvitation.js';

// Register checkout
export * from './members/checkout/BalanceItemCartItem.js';
export * from './members/checkout/RegisterCart.js';
export * from './members/checkout/RegisterCheckout.js';
export * from './members/checkout/RegisterItem.js';
export * from './members/checkout/RegistrationWithPlatformMember.js';

// Webshop
export * from './endpoints/WebshopOrdersQuery.js';
export * from './endpoints/WebshopTicketsQuery.js';
export * from './webshops/Cart.js';
export * from './webshops/CartItem.js';
export * from './webshops/CartStockHelper.js';
export * from './webshops/Category.js';
export * from './webshops/Checkout.js';
export * from './webshops/Customer.js';
export * from './webshops/Discount.js';
export * from './webshops/DiscountCode.js';
export * from './webshops/Order.js';
export * from './webshops/Product.js';
export * from './webshops/Ticket.js';
export * from './webshops/TransferSettings.js';
export * from './webshops/Webshop.js';
export * from './webshops/WebshopField.js';
export * from './webshops/WebshopMetaData.js';
export * from './webshops/WebshopWithOrganization.js';
export * from './webshops/UitpasNumberAndPrice.js';

// billing
export * from './billing/index.js';

// Checkout
export * from './checkout/index.js';

// Admin
export * from './admin/MemberSummary.js';
export * from './admin/StripePayoutExport.js';
export * from './Graph.js';

// Email
export * from './email/EmailAddressSettings.js';
export * from './email/EmailTemplate.js';

// Filters
export * from './filters/FilteredRequest.js';
export * from './filters/FilterCompilers.js';
export * from './filters/InMemoryFilter.js';
export * from './filters/inMemoryFilterDefinitions.js';
export * from './filters/InMemorySorter.js';
export * from './filters/PropertyFilter.js';
export * from './filters/searchFilterFactories.js';
export * from './filters/Sorters.js';
export * from './filters/SortList.js';
export * from './filters/StamhoofdFilter.js';
export * from './filters/SelectablePdfDocumentFilter.js';

// Balance
export * from './BalanceItem.js';
export * from './BalanceItemDetailed.js';
export * from './SponsorConfig.js';

export * from './filters/ExcelExportRequest.js';
export * from './filters/SearchFilterFactory.js';
export * from './helpers/index.js';

// Last
export * from './AuditLog.js';
export * from './AuditLogReplacement.js';

// Wire up circular dependencies
import './circular-dependencies/AuditLogReplacementDependencies.js';
import './circular-dependencies/ExampleReplacementsDependencies.js';
