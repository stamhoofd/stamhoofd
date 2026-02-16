import { column } from '@simonbackx/simple-database';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemStatus, DocumentData, DocumentPrivateSettings, DocumentSettings, DocumentStatus, DocumentTemplatePrivate, GroupType, NationalRegisterNumberOptOut, Parent, RecordAddressAnswer, RecordAnswer, RecordAnswerDecoder, RecordDateAnswer, RecordPriceAnswer, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { QueryableModel } from '@stamhoofd/sql';
import { render } from '../helpers/Handlebars.js';
import { BalanceItem } from './BalanceItem.js';
import { Document } from './Document.js';
import { Group } from './Group.js';
import { Member, RegistrationWithMember } from './Member.js';
import { Organization } from './Organization.js';
import { Registration } from './Registration.js';
import { User } from './User.js';

export class DocumentTemplate extends QueryableModel {
    static table = 'document_templates';

    @column({ primary: true, type: 'string', beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    /**
     * The HTML that is used to generate the PDF
     */
    @column({ type: 'string' })
    html: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string' })
    status = DocumentStatus.Draft;

    @column({ type: 'boolean' })
    updatesEnabled = true;

    /**
     * Settings of the smart document. This information is public
     */
    @column({ type: 'json', decoder: DocumentSettings })
    settings: DocumentSettings;

    /**
     *
     */
    @column({ type: 'json', decoder: DocumentPrivateSettings })
    privateSettings: DocumentPrivateSettings;

    @column({ type: 'integer' })
    year: number;

    @column({ type: 'datetime' })
    createdAt: Date = new Date();

    @column({ type: 'datetime', nullable: true, beforeSave() {
        if (this.publishedAt === null) {
            if ((this.status === DocumentStatus.Published)) {
                // set published at if published
                return new Date();
            }

            return null;
        }

        if (this.status === DocumentStatus.Draft) {
            // remove published at if draft
            return null;
        }

        return this.publishedAt;
    } })
    publishedAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    getPrivateStructure() {
        return DocumentTemplatePrivate.create(this);
    }

    /**
     * Still do an update when answers are locked
     */
    async updateAnswers(document: Document) {
        // Add global answers (same for each document)
        for (const answer of this.settings.fieldAnswers.values()) {
            // todo: check duplicate
            answer.reviewedAt = null;
            document.data.fieldAnswers.set(answer.settings.id, answer);
        }
    }

    /**
     * Returns the default answers for a given registration
     */
    async buildAnswers(registration: RegistrationWithMember): Promise<{ fieldAnswers: Map<string, RecordAnswer>; missingData: boolean }> {
        const fieldAnswers = new Map<string, RecordAnswer>();
        let missingData = false;

        const group = 'group' in registration ? registration.group as Group : await Group.getByID(registration.groupId);
        const { items: balanceItems, payments } = await BalanceItem.getForRegistration(registration.id, this.organizationId);

        const paidAtDates = payments.flatMap(p => p.paidAt ? [p.paidAt?.getTime()] : []);
        const price = balanceItems.reduce((sum, item) => sum + (item.priceOpen + item.pricePaid + item.pricePending), 0);
        const pricePaid = balanceItems.reduce((sum, item) => sum + item.pricePaid, 0);

        // We take the minimum date here, because there is a highter change of later paymetns to be for other things than the registration itself
        const paidAt = paidAtDates.length ? new Date(Math.min(...paidAtDates)) : null;

        // Some fields are supported by default in linked fields
        const defaultData: Record<string, RecordAnswer> = {
            'group.name': RecordTextAnswer.create({
                settings: RecordSettings.create({
                    id: 'group.name',
                    type: RecordType.Text,
                }),
                value: group?.settings?.name?.toString() ?? '',
            }),
            'group.type': RecordTextAnswer.create({
                settings: RecordSettings.create({
                    id: 'group.type',
                    type: RecordType.Text,
                }), // settings will be overwritten
                value: group?.type ?? '',
            }),
            'registration.startDate': RecordDateAnswer.create({
                settings: RecordSettings.create({
                    id: 'registration.startDate',
                    type: RecordType.Date,
                }), // settings will be overwritten
                dateValue: registration.startDate ?? group?.settings?.startDate,
            }),
            'registration.endDate': RecordDateAnswer.create({
                settings: RecordSettings.create({
                    id: 'registration.endDate',
                    type: RecordType.Date,
                }), // settings will be overwritten
                dateValue: registration.endDate ?? group?.settings?.endDate,
            }),
            'registration.price':
                RecordPriceAnswer.create({
                    settings: RecordSettings.create({
                        id: 'registration.price',
                        type: RecordType.Price,
                    }), // settings will be overwritten
                    value: price,
                }),
            // This one is duplicated in case it got disabled (we need to use it to check if document is included)
            'registration.priceOriginal':
                RecordPriceAnswer.create({
                    settings: RecordSettings.create({
                        id: 'registration.priceOriginal',
                        type: RecordType.Price,
                    }), // settings will be overwritten
                    value: price,
                }),
            // This one is duplicated in case it got disabled (we need to use it to check if document is included)
            'registration.pricePaidOriginal':
                RecordPriceAnswer.create({
                    settings: RecordSettings.create({
                        id: 'registration.pricePaidOriginal',
                        type: RecordType.Price,
                    }), // settings will be overwritten
                    value: pricePaid,
                }),
            'registration.pricePaid':
                RecordPriceAnswer.create({
                    settings: RecordSettings.create({
                        id: 'registration.pricePaid',
                        type: RecordType.Price,
                    }), // settings will be overwritten
                    value: pricePaid,
                }),
            'registration.paidAt':
                RecordDateAnswer.create({
                    settings: RecordSettings.create({
                        id: 'registration.paidAt',
                        type: RecordType.Date,
                        required: false,
                    }), // settings will be overwritten
                    dateValue: paidAt,
                }),
            'member.firstName': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.firstName,
            }),
            'member.lastName': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.lastName,
            }),
            'member.nationalRegisterNumber': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.nationalRegisterNumber === NationalRegisterNumberOptOut ? null : registration.member.details.nationalRegisterNumber,
            }),
            'member.address': RecordAddressAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                address: registration.member.details.address ?? registration.member.details.getAllAddresses()[0] ?? null,
            }),
            'member.email': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.getMemberEmails()[0] ?? registration.member.details.getParentEmails()[0],
            }),
            'member.birthDay': RecordDateAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                dateValue: registration.member.details.birthDay,
            }),
            'parents[0].firstName': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[0]?.firstName,
            }),
            'parents[0].lastName': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[0]?.lastName,
            }),
            'parents[0].nationalRegisterNumber': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[0]?.nationalRegisterNumber === NationalRegisterNumberOptOut ? null : registration.member.details.parents[0]?.nationalRegisterNumber,
            }),
            'parents[0].address': RecordAddressAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                address: registration.member.details.parents[0]?.address ?? null,
            }),
            'parents[0].email': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[0]?.email ?? null,
            }),
            'parents[1].firstName': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[1]?.firstName,
            }),
            'parents[1].lastName': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[1]?.lastName,
            }),
            'parents[1].nationalRegisterNumber': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[1]?.nationalRegisterNumber === NationalRegisterNumberOptOut ? null : registration.member.details.parents[1]?.nationalRegisterNumber,
            }),
            'parents[1].address': RecordAddressAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                address: registration.member.details.parents[1]?.address ?? null,
            }),
            'parents[1].email': RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[1]?.email ?? null,
            }),
        };

        const allRecords = this.privateSettings.templateDefinition.documentFieldCategories.flatMap(c => c.getAllRecords());
        const hasDebtor = allRecords.find(s => s.id.startsWith('debtor.'));

        if (hasDebtor) {
            const parentsWithNRN = registration.member.details.parents.filter(p => p.nationalRegisterNumber !== NationalRegisterNumberOptOut && p.nationalRegisterNumber);
            let debtor: Parent | undefined = parentsWithNRN[0] ?? registration.member.details.parents[0];
            if (parentsWithNRN.length > 1) {
                for (const balanceItem of balanceItems) {
                    if (balanceItem && balanceItem.userId && balanceItem.priceOpen === 0 && balanceItem.status === BalanceItemStatus.Due) {
                        const user = await User.getByID(balanceItem.userId);
                        if (user) {
                            const parent = parentsWithNRN.find(p => p.hasEmail(user.email));

                            if (parent) {
                                debtor = parent;
                                break;
                            }

                            if (!debtor.nationalRegisterNumber) {
                                const parent = registration.member.details.parents.find(p => p.hasEmail(user.email));
                                if (parent) {
                                    debtor = parent;
                                }
                            }
                        }
                    }
                }
            }

            Object.assign(defaultData, {
                'debtor.firstName': RecordTextAnswer.create({
                    settings: RecordSettings.create({}), // settings will be overwritten
                    value: debtor?.firstName ?? '',
                }),
                'debtor.lastName': RecordTextAnswer.create({
                    settings: RecordSettings.create({}), // settings will be overwritten
                    value: debtor?.lastName ?? '',
                }),
                'debtor.nationalRegisterNumber': RecordTextAnswer.create({
                    settings: RecordSettings.create({}), // settings will be overwritten
                    value: debtor?.nationalRegisterNumber === NationalRegisterNumberOptOut ? '' : debtor?.nationalRegisterNumber,
                }),
                'debtor.address': RecordAddressAnswer.create({
                    settings: RecordSettings.create({}), // settings will be overwritten
                    address: debtor?.address ?? null,
                }),
                'debtor.email': RecordTextAnswer.create({
                    settings: RecordSettings.create({}), // settings will be overwritten
                    value: debtor?.email ?? null,
                }),
            });
        }

        // Add data that is different for each member
        for (const field of allRecords) {
            // Where do we need to find the answer to this linked field?
            // - Could either return an id of a recordSetting connected to member
            // - or an idea of defaultData that is supported by default
            // The result is always a recordAnswer whose type should match the type of the linkedField
            let linkedToMemberAnswerSettingsIds = this.settings.linkedFields.get(field.id) ?? [field.id];

            if (linkedToMemberAnswerSettingsIds.length === 0) {
                linkedToMemberAnswerSettingsIds = [field.id];
            }

            // Check if this field has been manually disabled by a global checkbox
            const enableField = this.settings.fieldAnswers.get('enable[' + field.id + ']');
            if (enableField && enableField.objectValue === false) {
                field.required = false;

                const clone = RecordAnswerDecoder.getClassForType(field.type).create({
                    settings: field,
                });
                fieldAnswers.set(field.id, clone);
                continue;
            }

            let found = false;

            if (linkedToMemberAnswerSettingsIds) {
                for (const linkedToMemberAnswerSettingsId of linkedToMemberAnswerSettingsIds) {
                    if (linkedToMemberAnswerSettingsId) {
                        const answer = registration.member.details.recordAnswers.get(linkedToMemberAnswerSettingsId);
                        if (answer && !answer.isEmpty && answer.settings.type === field.type) {
                            // We need to link it with the settings in the template
                            const clone = answer.clone();
                            clone.settings = field;
                            clone.reviewedAt = null; // All linked fields are not reviewed. Unless they are manually changed by an admin later

                            found = true;
                            fieldAnswers.set(field.id, clone);
                            break;
                        }

                        // Check if supported by default
                        if (defaultData[linkedToMemberAnswerSettingsId] && !defaultData[linkedToMemberAnswerSettingsId].isEmpty) {
                            if (defaultData[linkedToMemberAnswerSettingsId] instanceof RecordAnswerDecoder.getClassForType(field.type)) {
                                // We need to clone here, because the same default data can be used in multiple places
                                const clone = defaultData[linkedToMemberAnswerSettingsId].clone();
                                clone.settings = field;

                                found = true;
                                fieldAnswers.set(field.id, clone);
                                break;
                            }
                            else {
                                console.warn('Found type mismatch for default data: ' + linkedToMemberAnswerSettingsId + ' - ' + field.id);
                            }
                        }
                    }
                }
            }

            if (!found && field.required) {
                missingData = true;
                console.log('Missing data because of required not found field');
            }

            if (!found) {
                // Add placeholder (so we have proper warnings)
                const clone = RecordAnswerDecoder.getClassForType(field.type).create({
                    settings: field,
                });
                fieldAnswers.set(field.id, clone);
            }
        }

        // Add other default data
        for (const key in defaultData) {
            if (defaultData[key] && defaultData[key].settings.id === key && !fieldAnswers.get(key)) {
                fieldAnswers.set(key, defaultData[key]);
            }
        }

        // Add group based answers (same for each group)
        for (const answer of this.privateSettings.groups.find(g => g.group.id === registration.groupId)?.fieldAnswers?.values() ?? []) {
            // todo: check duplicate
            answer.reviewedAt = null;
            fieldAnswers.set(answer.settings.id, answer);
        }

        // Add global answers (same for each document)
        for (const answer of this.settings.fieldAnswers.values()) {
            // todo: check duplicate
            answer.reviewedAt = null;
            fieldAnswers.set(answer.settings.id, answer);
        }

        // Verify answers
        if (!missingData) {
            for (const answer of fieldAnswers.values()) {
                try {
                    answer.validate();
                }
                catch (e) {
                    missingData = true;

                    console.log('Missing data because of validation error', e, answer, answer.settings);
                    break;
                }
            }
        }

        return {
            fieldAnswers,
            missingData,
        };
    }

    async updateForRegistrations(registrations: RegistrationWithMember[]): Promise<Document[]> {
        if (registrations.length === 0) {
            return [];
        }
        const existingDocuments = await Document.where({ templateId: this.id, registrationId: { sign: 'IN', value: registrations.map(r => r.id) } });
        const documents: Document[] = [];

        const includedRegistrations = registrations.filter(r => this.checkRegistrationIncluded(r));

        // Load groups
        const groupIds = Formatter.uniqueArray(includedRegistrations.map(r => r.groupId));
        const groups = await Group.getByIDs(...groupIds);

        for (const registration of registrations) {
            const group = groups.find(g => g.id === registration.groupId);
            if (group) {
                registration.setRelation(Registration.group, group);
            }
            documents.push(...await this.updateForRegistration(registration, existingDocuments.filter(d => d.registrationId === registration.id)));
        }

        return documents;
    }

    async updateForRegistration(registration: RegistrationWithMember, existingDocuments?: Document[]): Promise<Document[]> {
        existingDocuments = existingDocuments !== undefined ? existingDocuments : await Document.where({ templateId: this.id, registrationId: registration.id }, { limit: 5 });

        if (!this.checkRegistrationIncluded(registration)) {
            // Fast fail without building answers
            for (const document of existingDocuments) {
                await document.delete();
            }
            return [];
        }

        const { fieldAnswers, missingData } = await this.buildAnswers(registration);

        if (!this.checkAnswersIncluded(registration, fieldAnswers)) {
            for (const document of existingDocuments) {
                await document.delete();
            }
            return [];
        }

        const group = 'group' in registration ? registration.group as Group : await Group.getByID(registration.groupId);
        const description = `${registration.member.details.name}, ${group ? group.settings.name.toString() : ''}${group && group.settings.period && group.type === GroupType.Membership ? ' ' + group.settings.period?.nameShort : ''}`;

        if (existingDocuments.length > 0) {
            for (const document of existingDocuments) {
                await this.updateDocumentWithAnswers(document, fieldAnswers);
                document.data.name = this.settings.name;
                if (existingDocuments.length === 1) {
                    document.data.description = description;
                }
                if (document.status === DocumentStatus.Draft || document.status === DocumentStatus.Published) {
                    document.status = this.status;
                }
                await document.save();
            }
            return existingDocuments;
        }

        const document = new Document();
        document.organizationId = this.organizationId;
        document.templateId = this.id;
        document.status = missingData ? DocumentStatus.MissingData : this.status;
        document.data = DocumentData.create({
            name: this.settings.name,
            description,
            fieldAnswers,
        });
        document.memberId = registration.member.id;
        document.registrationId = registration.id;
        await document.save();
        return [document];
    }

    checkRegistrationIncluded(registration: Registration) {
        if (registration.organizationId !== this.organizationId) {
            return false;
        }

        if (registration.deactivatedAt) {
            return false;
        }

        if (!registration.registeredAt) {
            return false;
        }

        for (const groupDefinition of this.privateSettings.groups) {
            if (groupDefinition.group.id === registration.groupId) {
                return true;
            }
        }
        return false;
    }

    checkAnswersIncluded(registration: RegistrationWithMember, fieldAnswers: Map<string, RecordAnswer>) {
        if (this.settings.maxAge !== null) {
            const fieldId = 'registration.startDate';
            let startDate: null | Date = null;

            const answer = fieldAnswers.get(fieldId);
            if (answer && answer instanceof RecordDateAnswer) {
                if (!answer.isEmpty) {
                    startDate = answer.dateValue;
                }
            }

            if (startDate) {
                const age = registration.member.details.ageOnDate(startDate);

                if (age === null) {
                    console.warn('Missing member age checking maxAge');
                    return false;
                }

                if (age > this.settings.maxAge) {
                    return false;
                }
            }
            else {
                console.warn('Missing registration.startDate in fieldAnswers when checking maxAge');
            }
        }

        if (this.settings.minPrice !== null && this.settings.minPrice > 0) {
            const priceAnswer = fieldAnswers.get('registration.priceOriginal');
            if (priceAnswer && priceAnswer instanceof RecordPriceAnswer) {
                if ((priceAnswer.value ?? 0) < this.settings.minPrice) {
                    return false;
                }
            }
        }

        if (this.settings.minPricePaid !== null && this.settings.minPricePaid > 0) {
            const pricePaidAnswer = fieldAnswers.get('registration.pricePaidOriginal');
            const priceAnswer = fieldAnswers.get('registration.priceOriginal');
            const price = (priceAnswer instanceof RecordPriceAnswer ? priceAnswer.value : 0) ?? 0;
            const pricePaid = (pricePaidAnswer instanceof RecordPriceAnswer ? pricePaidAnswer.value : 0) ?? 0;

            if (pricePaid < this.settings.minPricePaid && price > 0) {
                return false;
            }
        }

        return true;
    }

    async buildAll({ generateNumbers = false } = {}) {
        QueueHandler.abort('documents-build-all/' + this.id);
        return await QueueHandler.schedule('documents-build-all/' + this.id, async ({ abort }) => {
            if (!this.updatesEnabled) {
                // Check status
                const documents = await Document.where({ templateId: this.id });
                for (const document of documents) {
                    abort.throwIfAborted();
                    await this.updateAnswers(document); // Only update global data
                    if (document.status === DocumentStatus.Draft || document.status === DocumentStatus.Published) {
                        document.status = this.status;
                        await document.save();
                    }
                }

                // Generate numbers for all documents
                if (generateNumbers) {
                    for (const document of documents) {
                        abort.throwIfAborted();
                        if (document.number === null && document.status === DocumentStatus.Published) {
                            document.number = this.nextNumberForDocuments(documents);
                            await document.save();
                        }
                    }
                }
                return documents;
            }

            console.log('Building all documents for template', this.id);
            const documentSet: Map<string, Document> = new Map();

            for (const groupDefinition of this.privateSettings.groups) {
                abort.throwIfAborted();

                // Get the registrations for this group with this cycle
                const registrations = await Member.getRegistrationWithMembersForGroup(groupDefinition.group.id);
                const documents = await this.updateForRegistrations(registrations);
                for (const document of documents) {
                    documentSet.set(document.id, document);
                }
            }

            console.log('Built all documents for template', this.id, documentSet.size);
            abort.throwIfAborted();

            // Delete documents that no longer match and don't have a number yet
            const documents = await Document.where({ templateId: this.id });
            for (const document of documents) {
                abort.throwIfAborted();
                if (!documentSet.has(document.id)) {
                    if (document.number === null) {
                        await document.delete();
                    }
                    else {
                        document.status = DocumentStatus.Deleted;
                        await document.save();
                    }
                }
            }

            const allDocuments = [...documentSet.values()];

            // Generate numbers for all documents
            if (generateNumbers) {
                for (const document of allDocuments) {
                    abort.throwIfAborted();
                    if (document.number === null && document.status === DocumentStatus.Published) {
                        document.number = this.nextNumberForDocuments(allDocuments);
                        await document.save();
                    }
                }
            }

            return allDocuments;
        });
    }

    private nextNumberForDocuments(documents: Document[]) {
        const sorted = documents.filter(d => d.status === DocumentStatus.Published && !!d.number).sort((a, b) => Sorter.byNumberValue(b.number ?? 0, a.number ?? 0));

        let lastNumber = 0;
        for (const document of sorted) {
            if (document.number === null) {
                continue;
            }

            if (document.number !== lastNumber + 1) {
                // Found a gap
                return lastNumber + 1;
            }
            lastNumber = document.number;
        }

        return lastNumber + 1;
    }

    private async buildContext(organization: Organization) {
        // Convert the field answers in a simplified javascript object
        const documents = (await this.buildAll({ generateNumbers: true })).filter(d => d.status === DocumentStatus.Published && !!d.number).sort((a, b) => Sorter.byNumberValue(b.number ?? 0, a.number ?? 0));

        // Check numbers are strictly increasing
        let lastNumber = 0;
        for (const document of documents) {
            if (document.number !== lastNumber + 1) {
                document.number = lastNumber + 1;
                await document.save();
            }
            lastNumber = document.number;
        }

        const data = {
            id: this.id,
            created_at: this.createdAt,
            documents: documents.map(d => d.buildContext(organization)),
            organization: {
                name: organization.name,
                companyName: organization.meta.companies[0]?.name || organization.name,
                companyNumber: organization.meta.companies[0]?.companyNumber || null,
                address: organization.address,
                companyAddress: organization.meta.companies[0]?.address ?? organization.address,
            },
        };

        for (const field of this.settings.fieldAnswers.values()) {
            const keys = field.settings.id.split('.');
            let current = data;
            const lastKey = keys.pop()!;
            if (!lastKey) {
                throw new Error('Invalid field id');
            }
            for (const key of keys) {
                if (!current[key]) {
                    current[key] = {};
                }
                current = current[key];

                if (typeof current !== 'object') {
                    throw new Error('Invalid field type');
                }
            }
            current[lastKey] = field.objectValue;
        }

        return data;
    }

    async getRenderedXml(organization: Organization) {
        if (!this.privateSettings.templateDefinition.xmlExport) {
            return null;
        }

        try {
            const context = await this.buildContext(organization);
            const renderedHtml = await render(this.privateSettings.templateDefinition.xmlExport, context);
            return renderedHtml;
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                throw e;
            }
            console.error('Failed to render document html', e);
            return null;
        }
    }

    areAnswersComplete(answers: Map<string, RecordAnswer>) {
        for (const field of this.privateSettings.templateDefinition.documentFieldCategories.flatMap(c => c.getAllRecords())) {
            const answer = answers.get(field.id);
            if (!answer) {
                return false;
            }
            // Update settings
            answer.settings = field;
            try {
                answer.validate();
            }
            catch (e) {
                // Invalid
                return false;
            }
        }
        return true;
    }

    async updateDocumentWithAnswers(document: Document, fieldAnswers: Map<string, RecordAnswer>) {
        const existingAnswers = document.data.fieldAnswers;

        const newAnswers = new Map(existingAnswers);

        for (const addAnswer of fieldAnswers.values()) {
            const existing = newAnswers.get(addAnswer.settings.id); // newAnswers.findIndex(a => a.settings.id === addAnswer.settings.id)
            if (existing) {
                // We already have an answer for this field, we'll only update it if addAnswer is reviewed later
                if (!existing.isReviewedAfter(addAnswer)) {
                    newAnswers.set(addAnswer.settings.id, addAnswer);
                }
            }
            else {
                newAnswers.set(addAnswer.settings.id, addAnswer);
            }
        }

        document.data.fieldAnswers = newAnswers;
        const complete = this.areAnswersComplete(newAnswers);

        if (document.status !== DocumentStatus.Deleted) {
            if (!complete) {
                document.status = DocumentStatus.MissingData;
            }
            else {
                if (document.status === DocumentStatus.MissingData) {
                    document.status = this.status;
                }
            }
        }
    }

    async updateDocumentFor(document: Document, registration: RegistrationWithMember) {
        const { fieldAnswers } = await this.buildAnswers(registration);
        await this.updateDocumentWithAnswers(document, fieldAnswers);
    }
}
