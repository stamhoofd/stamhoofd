import { AccessRightHelper } from '../AccessRight.js';
import { CountryHelper } from '../addresses/CountryDecoder.js';
import { AuditLogReplacementDependencies } from '../AuditLogReplacement.js';
import { STPackageTypeHelper } from '../billing/STPackage.js';
import { DocumentStatusHelper } from '../Document.js';
import { getGroupStatusName } from '../Group.js';
import { uuidToName } from '../helpers/uuidToName.js';
import { getGenderName } from '../members/Gender.js';
import { ParentTypeHelper } from '../members/ParentType.js';
import { OrganizationTypeHelper } from '../OrganizationType.js';
import { PaymentMethodHelper } from '../PaymentMethod.js';
import { PaymentStatusHelper } from '../PaymentStatus.js';
import { getSetupStepName } from '../SetupStepType.js';
import { UmbrellaOrganizationHelper } from '../UmbrellaOrganization.js';
import { OrderStatusHelper } from '../webshops/Order.js';
import { CheckoutMethodTypeHelper } from '../webshops/WebshopMetaData.js';

AuditLogReplacementDependencies.enumHelpers.push(
    PaymentMethodHelper.getPluralName,
    ParentTypeHelper.getName,
    OrderStatusHelper.getName,
    DocumentStatusHelper.getName,
    AccessRightHelper.getName,
    CheckoutMethodTypeHelper.getName,
    CountryHelper.getName,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    OrganizationTypeHelper.getName.bind(OrganizationTypeHelper) as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    PaymentStatusHelper.getName.bind(PaymentStatusHelper),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    UmbrellaOrganizationHelper.getName.bind(UmbrellaOrganizationHelper),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    STPackageTypeHelper.getName.bind(STPackageTypeHelper),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    ParentTypeHelper.getName.bind(ParentTypeHelper),
    getGroupStatusName,
    getGenderName,
    getSetupStepName,
);

AuditLogReplacementDependencies.uuidToName = uuidToName;
