import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { Replacement } from '../endpoints/EmailRequest.js';
import { Recipient } from '../endpoints/EmailRequest.js';
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

            if (variable instanceof EditorSmartVariable) {
                if (variable.id === 'outstandingBalance') {
                    // Hide outstandingBalance in combination with priceToPay - becuase these can be confused very easily.
                    // Although technically supported, we just hide it in the UI
                    if (replacements.find(r => r.token === 'priceToPay' && (r.value || r.html))) {
                        return false;
                    }
                }
            }

            if (variable.id === 'paymentUrl' && variable instanceof EditorSmartButton) {
                if (replacements.find(r => r.token === 'paymentTable' && (r.value || r.html))) {
                    // Rename default button in the case of mailing to payments
                    variable.text = $t('%1Mw');
                    variable.name = $t('%1Mx');
                    variable.hint = $t('%1My');
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
                name: $t(`%oZ`),
            }),
            EditorSmartVariable.create({
                id: 'firstName',
                name: $t(`%1MT`),
                deleteMessage: $t(`%oa`),
            }),
            EditorSmartVariable.create({
                id: 'lastName',
                name: $t(`%1MU`),
                deleteMessage: $t(`%ob`),
            }),
            EditorSmartVariable.create({
                id: 'email',
                name: $t(`%oc`),
            }),
            EditorSmartVariable.create({
                id: 'fromAddress',
                name: $t(`%od`),
            }),
            EditorSmartVariable.create({
                id: 'fromName',
                name: $t(`%oe`),
            }),
            EditorSmartVariable.create({
                id: 'firstNameMember',
                name: $t(`%of`),
                deleteMessage: $t(`%og`),
            }),
            EditorSmartVariable.create({
                id: 'lastNameMember',
                name: $t(`%oh`),
                deleteMessage: $t(`%oi`),
            }),
            EditorSmartVariable.create({
                id: 'inviterName',
                name: $t(`%oj`),
            }),
            EditorSmartVariable.create({
                id: 'platformOrOrganizationName',
                name: $t(`%ok`),
            }),
            EditorSmartVariable.create({
                id: 'outstandingBalance',
                name: $t(`%76`),
                deleteMessage: $t(`%ol`),
            }),
            EditorSmartVariable.create({
                id: 'registerUrl',
                name: $t(`%om`),
            }),
            EditorSmartVariable.create({
                id: 'resetUrl',
                name: $t(`%on`),
            }),
            EditorSmartVariable.create({
                id: 'confirmEmailCode',
                name: $t(`%oo`),
            }),
            EditorSmartVariable.create({
                id: 'loginDetails',
                name: $t(`%op`),
                hint: $t(`%oq`),
            }),

            EditorSmartVariable.create({
                id: 'feedbackText',
                name: $t('%B3'),
                hint: $t('%B4'),
            }),

            EditorSmartVariable.create({
                id: 'groupName',
                name: $t(`%or`),
            }),
            EditorSmartVariable.create({
                id: 'mailDomain',
                name: $t(`%os`),
            }),
        ];

        // if (this.orders.length > 0) {
        variables.push(EditorSmartVariable.create({
            id: 'nr',
            name: $t(`%xA`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderPrice',
            name: $t(`%ot`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderPrice',
            name: $t(`%ot`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderStatus',
            name: $t(`%ou`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderTime',
            name: $t(`%1GD`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderDate',
            name: $t(`%cC`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderMethod',
            name: $t(`%ov`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderLocation',
            name: $t(`%ow`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentMethod',
            name: $t(`%M7`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'priceToPay',
            name: $t(`%hF`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'pricePaid',
            name: $t(`%Ml`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferDescription',
            name: $t(`%ox`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferBankAccount',
            name: $t(`%oy`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferBankCreditor',
            name: $t(`%oz`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderTable',
            name: $t(`%p0`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'overviewTable',
            name: $t(`%1N1`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'balanceTable',
            name: $t(`%p1`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderDetailsTable',
            name: $t(`%p2`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentTable',
            name: $t(`%p3`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentData',
            name: $t(`%1N2`),
            description: $t('%1Mz'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'overviewContext',
            name: $t(`%p4`),
            description: $t('%1N0'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'memberNames',
            name: $t('%At'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'organizationName',
            name: $t('%1PW'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'objectName',
            name: $t(`%p5`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'webshopName',
            name: $t(`%p6`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'validUntil',
            name: $t(`%K4`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'validUntilDate',
            name: $t(`%p7`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'packageName',
            name: $t(`%p8`),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'submitterName',
            name: $t('%Ag'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'eventName',
            name: $t('%w9'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'dateRange',
            name: $t('%Ah'),
        }));

        // Fill examples using the example replacements
        this.fillExamples(variables, Object.values(ExampleReplacements.all));

        return variables;
    }
}
