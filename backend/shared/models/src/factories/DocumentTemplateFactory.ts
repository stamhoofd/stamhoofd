import { Factory } from '@simonbackx/simple-database';

import { DocumentPrivateSettings, DocumentSettings, DocumentStatus, DocumentTemplateDefinition, DocumentTemplateGroup, NamedObject, RecordCategory, RecordSettings, RecordType } from '@stamhoofd/structures';
import { DocumentTemplate, Group } from '../models';

class Options {
    groups: Group[];
    status?: DocumentStatus;
    updatesEnabled?: boolean;
    minPricePaid?: number | null;
    maxAge?: number | null;
}

export class DocumentTemplateFactory extends Factory<Options, DocumentTemplate> {
    async create(): Promise<DocumentTemplate> {
        const organizationId = this.options.groups[0].organizationId;

        const documentTemplate = new DocumentTemplate();
        documentTemplate.organizationId = organizationId;

        // HTML escaping is disabled to allow easy string contain checking in tests.
        documentTemplate.html = 'Document template HTML content';
        documentTemplate.html += '\nOrganization name: {{{organization.name}}}';
        documentTemplate.html += '\nMember name: {{{member.firstName}}} {{{member.lastName}}}';
        documentTemplate.html += '\nMember name using other variable: {{renamedValue}}';
        documentTemplate.html += '\nGroup name: {{{group.name}}}';
        documentTemplate.html += '\nStart: {{formatDate registration.startDate}}';
        documentTemplate.html += '\nEnd: {{formatDate registration.endDate}}';
        documentTemplate.html += '\nPrice: {{formatPrice registration.price}}';
        documentTemplate.html += '\nPrice paid: {{formatPrice registration.pricePaid}}';

        documentTemplate.status = this.options.status ?? DocumentStatus.Draft;
        documentTemplate.updatesEnabled = this.options.updatesEnabled ?? true;

        documentTemplate.settings = DocumentSettings.create({
            name: 'Test Document',
            minPricePaid: this.options.minPricePaid ?? null,
            maxAge: this.options.maxAge ?? null,
            fieldAnswers: new Map(),
            linkedFields: new Map([
                [
                    'renamedValue',
                    ['member.firstName'],
                ],
            ]),
        });

        documentTemplate.privateSettings = DocumentPrivateSettings.create({
            templateDefinition: DocumentTemplateDefinition.create({
                documentFieldCategories: [
                    RecordCategory.create({
                        records: [
                            RecordSettings.create({
                                id: 'member.nationalRegisterNumber',
                                required: false,
                                type: RecordType.Text,
                            }),
                            RecordSettings.create({
                                id: 'member.firstName',
                                required: false,
                                type: RecordType.Text,
                            }),
                            RecordSettings.create({
                                id: 'member.lastName',
                                required: false,
                                type: RecordType.Text,
                            }),
                            RecordSettings.create({
                                id: 'member.birthDay',
                                required: false,
                                type: RecordType.Date,
                            }),
                            RecordSettings.create({
                                id: 'member.address',
                                required: false,
                                type: RecordType.Address,
                            }),
                            RecordSettings.create({
                                id: 'renamedValue',
                                required: false,
                                type: RecordType.Text,
                            }),
                        ],
                    }),
                    RecordCategory.create({
                        records: [
                            RecordSettings.create({
                                id: 'group.name',
                                required: false,
                                type: RecordType.Text,
                            }),
                            RecordSettings.create({
                                id: 'registration.price',
                                required: false,
                                type: RecordType.Price,
                            }),
                            RecordSettings.create({
                                id: 'registration.pricePaid',
                                required: false,
                                type: RecordType.Price,
                            }),
                            RecordSettings.create({
                                id: 'registration.startDate',
                                required: false,
                                type: RecordType.Date,
                            }),
                            RecordSettings.create({
                                id: 'registration.endDate',
                                required: false,
                                type: RecordType.Date,
                            }),
                        ],
                    }),
                ],
            }),
        });

        for (const group of this.options.groups) {
            documentTemplate.privateSettings.groups.push(DocumentTemplateGroup.create({
                group: NamedObject.create({
                    id: group.id,
                    name: group.settings.name.toString(),
                }),
            }));
        }

        await documentTemplate.save();
        return documentTemplate as any;
    }
}
