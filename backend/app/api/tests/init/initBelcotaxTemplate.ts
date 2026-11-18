import type { DocumentTemplate, Organization } from '@stamhoofd/models';
import { Document, DocumentTemplateFactory } from '@stamhoofd/models';
import type { RecordAnswer } from '@stamhoofd/structures';
import {
    Address,
    DocumentData,
    DocumentStatus,
    RecordAddressAnswer,
    RecordChoice,
    RecordChooseOneAnswer,
    RecordDateAnswer,
    RecordPriceAnswer,
    RecordSettings,
    RecordTextAnswer,
    RecordType,
} from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';

import { belcotaxCompanyNumber } from './initBelcotax.js';

export const belcotaxAddress = Address.create({
    street: 'Kerkstraat',
    number: '1',
    postalCode: '9000',
    city: 'Gent',
    country: Country.Belgium,
});

type AnswerValue = string | Date | number | Address | RecordChoice;

export function belcotaxAnswers(values: Record<string, AnswerValue>): Map<string, RecordAnswer> {
    const map = new Map<string, RecordAnswer>();
    for (const [id, value] of Object.entries(values)) {
        if (value instanceof Address) {
            map.set(
                id,
                RecordAddressAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.Address }),
                    address: value,
                }),
            );
        } else if (value instanceof Date) {
            map.set(
                id,
                RecordDateAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.Date }),
                    dateValue: value,
                }),
            );
        } else if (value instanceof RecordChoice) {
            map.set(
                id,
                RecordChooseOneAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.ChooseOne }),
                    selectedChoice: value,
                }),
            );
        } else if (typeof value === 'number') {
            map.set(
                id,
                RecordPriceAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.Price }),
                    value,
                }),
            );
        } else {
            map.set(
                id,
                RecordTextAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.Text }),
                    value,
                }),
            );
        }
    }
    return map;
}

export const completeBelcotaxDocumentAnswers: Record<string, AnswerValue> = {
    'debtor.firstName': 'An',
    'debtor.lastName': 'Claes',
    'debtor.nationalRegisterNumber': '85.07.30-033.28',
    'debtor.address': belcotaxAddress,
    'member.firstName': 'Noah',
    'member.lastName': 'Claes',
    'member.nationalRegisterNumber': '18.05.05-123.72',
    'member.birthDay': new Date(2018, 4, 5),
    'member.address': belcotaxAddress,
    'registration.startDate': new Date(2026, 6, 1),
    'registration.endDate': new Date(2026, 6, 5),
    'registration.price': 75_0000,
};

/**
 * A published fiscal template of 2026, organised by the company of initBelcotaxOrganization
 */
export async function createBelcotaxTemplate(organization: Organization) {
    const template = await new DocumentTemplateFactory({
        organizationId: organization.id,
        type: 'fiscal',
        groups: [],
        year: 2026,
        updatesEnabled: false,
        status: DocumentStatus.Published,
    }).create();
    template.settings.name = 'Kamp 2026';
    template.settings.fieldAnswers = belcotaxAnswers({
        'organization.companyName': 'Jeugdhuis De Kelder vzw',
        'organization.companyNumber': belcotaxCompanyNumber,
        'organization.companyAddress': belcotaxAddress,
        'organization.contactName': 'Els Wouters',
        'organization.phone': '0470 12 34 56',
        'organization.email': 'els@dekelder.be',
        'certification.type': RecordChoice.create({ id: 'authorities' }),
        'certification.name': 'Stad Gent',
        'certification.companyNumber': '0207451227',
        'certification.address': belcotaxAddress,
    });
    await template.save();
    return template;
}

/**
 * The description is "<first name> Claes, Kamp 2026". The first name of the child chooses the outcome of the
 * Belcotax mock (belcotaxMockFirstNames).
 */
export async function createBelcotaxDocument(
    template: DocumentTemplate,
    childFirstName = 'Noah',
    status = DocumentStatus.Published,
) {
    const document = new Document();
    document.organizationId = template.organizationId;
    document.templateId = template.id;
    document.status = status;
    document.data = DocumentData.create({
        name: 'Fiscaal attest 2026',
        description: `${childFirstName} Claes, Kamp 2026`,
        fieldAnswers: belcotaxAnswers({
            ...completeBelcotaxDocumentAnswers,
            'member.firstName': childFirstName,
        }),
    });
    await document.save();
    return document;
}
