import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Recipient, Replacement } from '../endpoints/EmailRequest.js';
import { EditorSmartButton } from './EditorSmartButton.js';
import { EmailRecipient } from './Email.js';
import { ExampleReplacements } from './exampleReplacements.js';

export class EditorSmartVariable extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder, nullable: true })
    description: string | null = null;

    @field({ decoder: StringDecoder })
    example = '';

    @field({ decoder: StringDecoder, optional: true })
    html?: string;

    @field({ decoder: StringDecoder, optional: true })
    deleteMessage?: string;

    @field({ decoder: StringDecoder, optional: true })
    hint?: string;

    getJSONContent() {
        return { type: this.html ? 'smartVariableBlock' : 'smartVariable', attrs: { id: this.id } };
    }

    static forRecipient(recipient: EmailRecipient | Recipient) {
        const replacements = [...recipient.replacements, ...recipient.getDefaultReplacements()];
        return this.forReplacements(replacements);
    }

    static forReplacements(replacements: Replacement[]) {
        return this.fillExamples(this.all.map(v => v.clone()), replacements);
    }

    static fillExamples<T extends EditorSmartVariable | EditorSmartButton>(list: T[], replacements: Replacement[]) {
        return list.filter((variable) => {
            // Always supported: signInUrl + unsubscribeUrl
            if (variable.id === 'signInUrl' || variable.id === 'unsubscribeUrl') {
                return true;
            }

            const replacement = replacements.find(r => r.token === variable.id && (r.value || r.html));
            if (!replacement) {
                // Not found
                return false;
            }
            else {
                if (variable instanceof EditorSmartVariable) {
                    if (replacement.html) {
                        variable.html = replacement.html;
                        variable.example = '';
                    }
                    else if (replacement.value) {
                        variable.example = replacement.value;
                        variable.html = undefined;
                    }
                }
                else {
                    // Do not change text
                }
            }
            return true;
        });
    }

    static get all() {
        /**
         * Note: please also add the corresponding default replacements to `shared/structures/src/email/exampleReplacements.ts`
         * and only add the example or html there. You should not fill it in here, that will happen automatically.
         */
        const variables = [
            EditorSmartVariable.create({
                id: 'greeting',
                name: $t(`281d013c-485d-4592-88bf-6518774795c8`),
            }),
            EditorSmartVariable.create({
                id: 'firstName',
                name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
                deleteMessage: $t(`90f2e835-e3a0-4ea9-bf5d-36d97ccab5f4`),
            }),
            EditorSmartVariable.create({
                id: 'lastName',
                name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
                deleteMessage: $t(`7e7a5858-0252-45f7-b740-346d81bed6a9`),
            }),
            EditorSmartVariable.create({
                id: 'email',
                name: $t(`4e95caa9-bc2d-4772-80b2-624c42216c90`),
            }),
            EditorSmartVariable.create({
                id: 'fromAddress',
                name: $t(`80812624-3d10-48b1-b897-90609b35b403`),
            }),
            EditorSmartVariable.create({
                id: 'fromName',
                name: $t(`ed36b1bc-ab02-471d-9754-9d9be0fa791f`),
            }),
            EditorSmartVariable.create({
                id: 'firstNameMember',
                name: $t(`9c0921f0-1c1e-4318-9621-7137c7a3bc98`),
                deleteMessage: $t(`eb7d2233-b02c-44b6-983c-d7fdb6ef1fa1`),
            }),
            EditorSmartVariable.create({
                id: 'lastNameMember',
                name: $t(`3fe55cf3-7c12-4b03-adce-14f99749a7af`),
                deleteMessage: $t(`1534ebf6-e8d3-44e8-ab86-7ebcaac62156`),
            }),
            EditorSmartVariable.create({
                id: 'inviterName',
                name: $t(`be6cb896-09ec-4066-a4bd-c16eafd0fa67`),
            }),
            EditorSmartVariable.create({
                id: 'platformOrOrganizationName',
                name: $t(`b7298a1c-aba3-4839-a7e0-b0e390d07476`),
            }),
            EditorSmartVariable.create({
                id: 'outstandingBalance',
                name: $t(`40d7ac9f-f62d-4a9d-8b2f-5fcfb938c12f`),
                deleteMessage: $t(`8376c638-2c84-4710-9d85-84f1b0fa8ae9`),
            }),
            EditorSmartVariable.create({
                id: 'registerUrl',
                name: $t(`4ee07a18-6061-484a-94ea-6d2f950f0f34`),
            }),
            EditorSmartVariable.create({
                id: 'resetUrl',
                name: $t(`7c1bf6b8-6133-4e88-9603-43ae0f91b018`),
            }),
            EditorSmartVariable.create({
                id: 'confirmEmailCode',
                name: $t(`0c009c51-7145-431c-b41d-60ed8d0e832f`),
            }),
            EditorSmartVariable.create({
                id: 'loginDetails',
                name: $t(`6e4859e1-c98c-47df-a340-52e3b28ca53b`),
                hint: $t(`dacb0698-1ea9-4ee8-b8ce-a2cb4e3ff01c`),
            }),

            EditorSmartVariable.create({
                id: 'feedbackText',
                name: $t('f90728f1-0e73-4027-9408-adfc38c9a4f0'),
                hint: $t('21c3edb6-8c2d-43c2-8c51-245d75006774'),
            }),

            EditorSmartVariable.create({
                id: 'groupName',
                name: $t(`bc898c83-c02e-4ea2-a19f-80d2037c47b8`),
            }),
            EditorSmartVariable.create({
                id: 'mailDomain',
                name: $t(`6c1f211b-5409-4e55-8ee9-f80badb919c2`),
            }),
        ];

        // if (this.orders.length > 0) {
        variables.push(EditorSmartVariable.create({
            id: 'nr',
            name: $t(`4d496edf-0203-4df3-a6e9-3e58d226d6c5`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderPrice',
            name: $t(`f9dce2e6-4292-46f0-87cb-810375e88678`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderPrice',
            name: $t(`f9dce2e6-4292-46f0-87cb-810375e88678`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderStatus',
            name: $t(`1e3b3563-93bf-4d5b-90e9-bbcbbbe1168f`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderTime',
            name: $t(`7853cca1-c41a-4687-9502-190849405f76`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderDate',
            name: $t(`3c712881-ef26-474f-a431-dd1c74011260`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderMethod',
            name: $t(`1dee5fbc-ed10-4290-be15-06839cb4672c`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderLocation',
            name: $t(`de85a91b-0446-4fc5-9a3f-422d86ccde0e`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentMethod',
            name: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'priceToPay',
            name: $t(`495e591a-15f2-43f3-ba4f-f02598624f52`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentPrice',
            name: $t(`495e591a-15f2-43f3-ba4f-f02598624f52`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'pricePaid',
            name: $t(`25c803f0-6b45-42aa-9b88-573e3706b8bb`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferDescription',
            name: $t(`a11d5bd4-71cc-4790-a15a-7e9ca0fc18e2`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferBankAccount',
            name: $t(`f86209c8-b630-4906-867e-ef1e5a36b40a`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferBankCreditor',
            name: $t(`ace46014-f3b5-4d9f-8ac1-4f5721bfdab2`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderTable',
            name: $t(`496c04a5-77a2-4683-a2b9-20d3bc78f40a`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'overviewTable',
            name: $t(`b510871b-dac3-4188-bfe1-f51ad7577432`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'balanceItemPaymentsTable',
            name: $t(`Tabel met betaalitems`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'balanceTable',
            name: $t(`21b27a40-29f9-4cd7-ab26-76778466a6f1`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderDetailsTable',
            name: $t(`cb11c3ed-fb73-4461-bdbc-d7c044dbd47c`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentTable',
            name: $t(`73bf7acd-90f4-4346-97e9-3d9415ca5952`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentData',
            name: $t(`Tabel met gegevens`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'overviewContext',
            name: $t(`a62f0a8f-384b-403a-9bc3-c719ca3839cf`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'memberNames',
            name: $t('bd54c45e-d3df-444e-b5d9-9722a6e08999'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'organizationName',
            name: $t('e07bc7a1-92c0-48fc-91f3-46e12573ee03'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'objectName',
            name: $t(`93cf7cea-7bb7-4ee5-83bb-7206bde4e7ae`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'webshopName',
            name: $t(`db8bcb81-74c5-4f08-a28a-b80aaf2e5ef5`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'validUntil',
            name: $t(`52ab641f-5864-4fac-8c52-0df00ad7e0a9`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'validUntilDate',
            name: $t(`47309919-e146-4405-b4f0-ad2c7c923d75`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'packageName',
            name: $t(`1826aa80-c057-4739-911e-334e037348db`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'submitterName',
            name: $t('5685519b-26b5-43cf-b1f3-73fdc2e642cd'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'eventName',
            name: $t('cb76c693-29ff-4d41-9c45-56106a798818'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'dateRange',
            name: $t('44f90dca-5bb1-4bad-bf03-fd425cdb6a03'),
        }));

        // Fill examples using the example replacements
        this.fillExamples(variables, Object.values(ExampleReplacements.all));

        return variables;
    }
}
