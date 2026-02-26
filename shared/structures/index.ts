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
export { Version } from './src/Version.js';

export * from './src/PriceBreakdown.js';

// General
export * from './src/AppType.js';
export * from './src/Language.js';
export * from './src/TranslatedString.js';
export * from './src/AccessRight.js';
export * from './src/addresses/Address.js';
export * from './src/addresses/City.js';
export * from './src/addresses/CountryDecoder.js';
export * from './src/addresses/Premise.js';
export * from './src/addresses/Province.js';
export * from './src/addresses/SearchRegions.js';
export * from './src/Company.js';
export * from './src/DefaultAgeGroup.js';
export * from './src/Document.js';
export * from './src/Event.js';
export * from './src/ReduceablePrice.js';
export * from './src/EventNotification.js';
export * from './src/EventNotificationStatus.js';
export * from './src/EventNotificationType.js';
export * from './src/GenericBalance.js';
export * from './src/Group.js';
export * from './src/GroupCategory.js';
export * from './src/GroupGenderType.js';
export * from './src/GroupPrivateSettings.js';
export * from './src/GroupSettings.js';
export * from './src/GroupType.js';
export * from './src/LoginMethod.js';
export * from './src/MemberResponsibility.js';
export * from './src/members/MemberPlatformMembership.js';
export * from './src/members/MemberResponsibilityRecord.js';
export * from './src/members/NationalRegisterNumberOptOut.js';
export * from './src/OldGroupPrices.js';
export * from './src/OpenID.js';
export * from './src/Organization.js';
export * from './src/OrganizationEmail.js';
export * from './src/OrganizationGenderType.js';
export * from './src/OrganizationLevelRecordsConfiguration.js';
export * from './src/OrganizationMetaData.js';
export * from './src/OrganizationPrivateMetaData.js';
export * from './src/OrganizationSimple.js';
export * from './src/OrganizationType.js';
export * from './src/PaymentConfiguration.js';
export * from './src/PaymentCustomer.js';
export * from './src/PaymentMethod.js';
export * from './src/PaymentProvider.js';
export * from './src/PaymentStatus.js';
export * from './src/PaymentType.js';
export * from './src/PermissionLevel.js';
export * from './src/PermissionRole.js';
export * from './src/Permissions.js';
export * from './src/PermissionsByRole.js';
export * from './src/PermissionsResourceType.js';
export * from './src/Platform.js';
export * from './src/PlatformServerConfig.js';
export * from './src/Policy.js';
export * from './src/ReceivableBalance.js';
export * from './src/RegisterCodeStatus.js';
export * from './src/RegistrationPeriod.js';
export * from './src/RegistrationPeriodBase.js';
export * from './src/ResourcePermissions.js';
export * from './src/RichText.js';
export * from './src/SeatingPlan.js';
export * from './src/SetupStepReview.js';
export * from './src/SetupSteps.js';
export * from './src/SetupStepType.js';
export * from './src/StockReservation.js';
export * from './src/StripeAccount.js';
export * from './src/Token.js';
export * from './src/UmbrellaOrganization.js';
export * from './src/User.js';
export * from './src/BundleDiscount.js';
export * from './src/BundleDiscountGroupPriceSettings.js';
export * from './src/GroupPriceDiscount.js';
export * from './src/members/MembershipStatus.js';
export * from './src/AppliedRegistrationDiscount.js';
export * from './src/MemberAdmin.js';
export * from './src/LoadedPermissions.js';
export * from './src/UitpasClientCredentialsStatus.js';
export * from './src/members/UitpasNumberDetails.js';
export * from './src/getActivePeriods.js';

// UserPermissions
export * from './src/UserPermissions.js';
export * from './src/UserWithMembers.js';

// Endpoints
export * from './src/DNSRecord.js';
export * from './src/endpoints/ChargeMembershipsSummary.js';
export * from './src/endpoints/ChargeRequest.js';
export * from './src/endpoints/CheckMollieResponse.js';
export * from './src/endpoints/CreateOrganization.js';
export * from './src/endpoints/EmailRequest.js';
export * from './src/endpoints/ForgotPasswordRequest.js';
export * from './src/endpoints/OrganizationAdmins.js';
export * from './src/endpoints/OrganizationDomains.js';
export * from './src/endpoints/PayableBalanceCollection.js';
export * from './src/endpoints/RegisterMember.js';
export * from './src/endpoints/RegisterResponse.js';
export * from './src/endpoints/SignupResponse.js';
export * from './src/endpoints/tokens/ChallengeGrantStruct.js';
export * from './src/endpoints/tokens/CreateTokenStruct.js';
export * from './src/endpoints/tokens/PasswordGrantStruct.js';
export * from './src/endpoints/tokens/PasswordTokenGrantStruct.js';
export * from './src/endpoints/tokens/RefreshTokenGrantStruct.js';
export * from './src/endpoints/tokens/RequestChallengeGrantStruct.js';
export * from './src/endpoints/VerifyEmailRequest.js';
export * from './src/endpoints/WebshopUriAvailabilityResponse.js';
export * from './src/endpoints/UitpasPriceCheckRequest.js';
export * from './src/endpoints/UitpasOrganizersResponse.js';
export * from './src/endpoints/UitpasEventsResponse.js';
export * from './src/endpoints/UitpasClientIdAndSecret.js';
export * from './src/endpoints/UitpasSetClientCredentialsResponse.js';
export * from './src/endpoints/UitpasNumbersGetDetailsRequest.js';

// email
export * from './src/email/EditorSmartButton.js';
export * from './src/email/EditorSmartVariable.js';
export * from './src/email/Email.js';

// Grouping
export * from './src/grouping/PaginatedResponse.js';

// Members
export * from './src/files/File.js';
export * from './src/files/Image.js';
export * from './src/files/Resolution.js';
export * from './src/files/ResolutionRequest.js';
export * from './src/members/EmergencyContact.js';
export * from './src/members/Gender.js';
export * from './src/members/Member.js';
export * from './src/members/MemberDetails.js';
export * from './src/members/MemberWithRegistrationsBlob.js';
export * from './src/members/ObjectWithRecords.js';
export * from './src/members/OrganizationRecordsConfiguration.js';
export * from './src/members/Parent.js';
export * from './src/members/ParentType.js';
export * from './src/members/Payment.js';
export * from './src/members/PaymentGeneral.js';
export * from './src/members/PlatformMember.js';
export * from './src/members/records/LegacyRecord.js';
export * from './src/members/records/LegacyRecordType.js';
export * from './src/members/records/RecordAnswer.js';
export * from './src/members/records/RecordCategory.js';
export * from './src/members/records/RecordConfigurationFactory.js';
export * from './src/members/records/RecordFactory.js';
export * from './src/members/records/RecordSettings.js';
export * from './src/members/Registration.js';
export * from './src/members/RegistrationWithEncryptedMember.js';
export * from './src/members/RegistrationWithTinyMember.js';
export * from './src/members/ReviewTime.js';
export * from './src/members/RegistrationWithMemberBlob.js';
export * from './src/members/RegistrationsBlob.js';

// Register checkout
export * from './src/members/checkout/BalanceItemCartItem.js';
export * from './src/members/checkout/RegisterCart.js';
export * from './src/members/checkout/RegisterCheckout.js';
export * from './src/members/checkout/RegisterItem.js';
export * from './src/members/checkout/RegistrationWithPlatformMember.js';

// Webshop
export * from './src/endpoints/WebshopOrdersQuery.js';
export * from './src/endpoints/WebshopTicketsQuery.js';
export * from './src/webshops/Cart.js';
export * from './src/webshops/CartItem.js';
export * from './src/webshops/CartStockHelper.js';
export * from './src/webshops/Category.js';
export * from './src/webshops/Checkout.js';
export * from './src/webshops/Customer.js';
export * from './src/webshops/Discount.js';
export * from './src/webshops/DiscountCode.js';
export * from './src/webshops/Order.js';
export * from './src/webshops/Product.js';
export * from './src/webshops/Ticket.js';
export * from './src/webshops/TransferSettings.js';
export * from './src/webshops/Webshop.js';
export * from './src/webshops/WebshopField.js';
export * from './src/webshops/WebshopMetaData.js';
export * from './src/webshops/UitpasNumberAndPrice.js';

// billing
export * from './src/billing/index.js';

// Checkout
export * from './src/checkout/index.js';

// Admin
export * from './src/admin/MemberSummary.js';
export * from './src/admin/OrganizationSummary.js';
export * from './src/admin/StripePayoutExport.js';
export * from './src/Graph.js';

// Email
export * from './src/email/EmailAddressSettings.js';
export * from './src/email/EmailTemplate.js';

// Filters
export * from './src/filters/FilteredRequest.js';
export * from './src/filters/FilterCompilers.js';
export * from './src/filters/InMemoryFilter.js';
export * from './src/filters/inMemoryFilterDefinitions.js';
export * from './src/filters/InMemorySorter.js';
export * from './src/filters/PropertyFilter.js';
export * from './src/filters/searchFilterFactories.js';
export * from './src/filters/Sorters.js';
export * from './src/filters/SortList.js';
export * from './src/filters/StamhoofdFilter.js';
export * from './src/filters/SelectablePdfDocumentFilter.js';

// Balance
export * from './src/BalanceItem.js';
export * from './src/BalanceItemDetailed.js';
export * from './src/SponsorConfig.js';

export * from './src/filters/ExcelExportRequest.js';
export * from './src/filters/SearchFilterFactory.js';
export * from './src/helpers/index.js';

// Last
export * from './src/AuditLog.js';
export * from './src/AuditLogReplacement.js';

// Wire up circular dependencies
import './src/circular-dependencies/AuditLogReplacementDependencies.js';
import './src/circular-dependencies/ExampleReplacementsDependencies.js';
