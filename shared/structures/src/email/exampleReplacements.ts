import { Formatter } from '@stamhoofd/utility';
import { BalanceItem } from '../BalanceItem.js';
import { STPackageType, STPackageTypeHelper } from '../billing/STPackage.js';
import { Replacement } from '../endpoints/EmailRequest.js';

const exampleBalanceItem = BalanceItem.create({
    // todo translations
    description: 'Voorbeeld item 1',
    amount: 5,
    unitPrice: 1000,
});

const exampleBalanceItem2 = BalanceItem.create({
    // todo translations
    description: 'Voorbeeld item 2',
    amount: 1,
    unitPrice: 500,
});

let _injectedReplacementValues = (replacements: Replacement[]): void => {
    throw new Error('injectReplacementValues is not yet injected. Call injectReplacementValues to inject dependencies.');
};

export function injectReplacementValues(injected: typeof _injectedReplacementValues) {
    _injectedReplacementValues = injected;
}

let filled = false;
let _ExampleReplacements: ReturnType<typeof getReplacements> = {} as any;

function fillReplacementsIfNeeded() {
    if (!filled) {
        _ExampleReplacements = getReplacements();
        _injectedReplacementValues(Object.values(_ExampleReplacements));
        filled = true;
    }
}

export const ExampleReplacements = {
    get all() {
        fillReplacementsIfNeeded();
        return _ExampleReplacements;
    },

    get default() {
        fillReplacementsIfNeeded();
        return [
            _ExampleReplacements.greeting,
            _ExampleReplacements.firstName,
            _ExampleReplacements.lastName,
            _ExampleReplacements.email,
            _ExampleReplacements.organizationName,
            _ExampleReplacements.fromAddress,
            _ExampleReplacements.fromName,
        ];
    },
};

function getReplacements() {
    /**
     * Note: please also add the corresponding smart variable to shared/structures/src/email/EditorSmartVariable.ts
     * and the corresponding buttons to shared/structures/src/email/EditorSmartButton.ts
     */
    const htmlPlaceholder = `<p class="description">${$t('2302cff3-771a-47be-9edd-146fb4b4ea88')}</p>`;
    const textPlaceholder = $t(`734e03f9-3d03-4c4c-929f-657af725e4f0`);

    return {
        greeting: Replacement.create({
            token: 'greeting',
            value: $t(`55c039f3-987d-4f42-9db4-b05dc9a6d996`),
        }),
        firstName: Replacement.create({
            token: 'firstName',
            value: $t(`b115e024-edc7-401b-8e41-2da247822e9e`),
        }),
        lastName: Replacement.create({
            token: 'lastName',
            value: $t(`7c619773-33de-451c-9f8e-695e871058bb`),
        }),
        email: Replacement.create({
            token: 'email',
            value: $t(`46e8393a-144d-477e-9b9e-c79616e4b9a7`),
        }),
        fromAddress: Replacement.create({
            token: 'fromAddress',
            value: $t(`c5e8403a-3d2c-46f4-b21f-03be750eacbd`),
        }),
        fromName: Replacement.create({
            token: 'fromName',
            value: $t(`1e69f4ff-0496-4d23-a2f4-0a116b9c35f0`),
        }),
        paymentUrl: Replacement.create({
            token: 'paymentUrl',
            value: 'https://www.example.com/payment',
        }),
        balanceTable: Replacement.create({
            token: 'balanceTable',
            html: BalanceItem.getDetailsHTMLTable([
                exampleBalanceItem,
                exampleBalanceItem2,
            ]),
        }),
        outstandingBalance: Replacement.create({
            token: 'outstandingBalance',
            value: '€ 55,00',
        }),
        objectName: Replacement.create({
            token: 'objectName',
            value: $t(`db31945c-b255-4f37-b866-489befc61810`),
        }),
        resetUrl: Replacement.create({
            token: 'resetUrl',
            value: $t(`80c2fd05-aba8-4261-bf68-2f2e07ae872b`),
        }),
        confirmEmailUrl: Replacement.create({
            token: 'confirmEmailUrl',
            value: 'https://www.example.com/confirm-email',
        }),
        confirmEmailCode: Replacement.create({
            token: 'confirmEmailCode',
            value: '123 456',
        }),
        organizationName: Replacement.create({
            token: 'organizationName',
            value: $t('aeace79f-c772-4944-8d1d-f92eb519267f'),
        }),
        platformOrOrganizationName: Replacement.create({
            token: 'platformOrOrganizationName',
            value: $t('6f77926b-801a-477d-8254-78166ca8e6be'),
        }),
        feedbackText: Replacement.create({
            token: 'feedbackText',
            html: '<p class="pre-wrap"><em>' + Formatter.escapeHtml($t('ac49cf9f-c0de-479c-829d-99e7a31874d2')) + '</em></p>',
        }),
        downloadUrl: Replacement.create({
            token: 'downloadUrl',
            value: 'https://www.example.com/download',
        }),
        reviewUrl: Replacement.create({
            token: 'reviewUrl',
            value: 'https://www.example.com/review',
        }),
        submitterName: Replacement.create({
            token: 'submitterName',
            value: $t(`7afd1f1f-f818-40c9-b872-32d93be3958b`),
        }),
        eventName: Replacement.create({
            token: 'eventName',
            value: $t('aaaaf4eb-6714-42b8-bd94-aa167246cac6'),
        }),
        dateRange: Replacement.create({
            token: 'dateRange',
            value: $t('b66ae14a-e02d-4c80-bec2-d7440da7643f'),
        }),
        inviterName: Replacement.create({
            token: 'inviterName',
            value: $t(`ce00a7f3-4be9-4da8-833f-e13ff3b3fb14`),
        }),
        validUntil: Replacement.create({
            token: 'validUntil',
            value: Formatter.dateTime(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
        }),
        validUntilDate: Replacement.create({
            token: 'validUntilDate',
            value: Formatter.date(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
        }),
        firstNameMember: Replacement.create({
            token: 'firstNameMember',
            value: $t(`65c9a375-fbca-4a27-9a42-01d49f7f9588`),
        }),
        lastNameMember: Replacement.create({
            token: 'lastNameMember',
            value: $t(`e028c78a-166d-4531-b03b-99a573f1661b`),
        }),
        registerUrl: Replacement.create({
            token: 'registerUrl',
            value: $t(`c89a6220-9e60-4f0c-9404-d9cb0fc301f7`),
        }),
        groupName: Replacement.create({
            token: 'groupName',
            value: $t('07290df8-cad5-40df-9e10-3c7eccc049bc'),
        }),
        signInUrl: Replacement.create({
            token: 'signInUrl',
            value: 'https://www.example.com/sign-in',
        }),
        unsubscribeUrl: Replacement.create({
            token: 'unsubscribeUrl',
            value: 'https://www.example.com/unsubscribe',
        }),
        renewUrl: Replacement.create({
            token: 'renewUrl',
            value: 'https://www.example.com/renew',
        }),
        loginDetails: Replacement.create({
            token: 'loginDetails',
            html: `<p class="description"><em>${$t('5403b466-98fe-48ac-beff-38acf7c9734d', {
                email: '<strong>' + $t(`46e8393a-144d-477e-9b9e-c79616e4b9a7`) + '</strong>' },
            )} ${$t('e2519632-c495-4629-9ddb-334a4f00e272', {
                firstName: $t(`65c9a375-fbca-4a27-9a42-01d49f7f9588`),
                securityCode: `<span class="style-inline-code">xxxx-xxxx-xxxx-xxxx</span>`,
            })}</em></p>`,
        }),
        mailDomain: Replacement.create({
            token: 'mailDomain',
            value: $t(`aa5606d0-ed51-4228-938e-656da8c41cfc`),
        }),
        paymentMethod: Replacement.create({
            token: 'paymentMethod',
            value: $t(`8f9575f3-9787-4fa5-9ddf-dd1fa4103996`),
        }),
        priceToPay: Replacement.create({
            token: 'priceToPay',
            value: '€ 40,50',
        }),
        paymentPrice: Replacement.create({
            token: 'paymentPrice',
            value: textPlaceholder,
        }),
        transferDescription: Replacement.create({
            token: 'transferDescription',
            value: '+++111/111/111+++',
        }),
        transferBankAccount: Replacement.create({
            token: 'transferBankAccount',
            value: 'BE1234 1234 1234',
        }),
        transferBankCreditor: Replacement.create({
            token: 'transferBankCreditor',
            value: $t('aeace79f-c772-4944-8d1d-f92eb519267f'),
        }),
        overviewContext: Replacement.create({
            token: 'overviewContext',
            value: $t(`967a1b0b-88cd-4b95-9008-f0610ed64b24`),
        }),
        memberNames: Replacement.create({
            token: 'memberNames',
            value: $t(`990581a8-e4db-4c33-b36b-4df045f8c294`),
        }),
        overviewTable: Replacement.create({
            token: 'overviewTable',
            html: htmlPlaceholder,
        }),
        balanceItemPaymentsTable: Replacement.create({
            token: 'balanceItemPaymentsTable',
            html: htmlPlaceholder,
        }),
        paymentTable: Replacement.create({
            token: 'paymentTable',
            html: htmlPlaceholder,
        }),
        packageName: Replacement.create({
            token: 'packageName',
            value: STPackageTypeHelper.getName(STPackageType.Members),
        }),
        orderPrice: Replacement.create({
            token: 'orderPrice',
            value: '€ 15,00',
        }),
        orderStatus: Replacement.create({
            token: 'orderStatus',
            value: textPlaceholder,
        }),
        nr: Replacement.create({
            token: 'nr',
            value: '15',
        }),
        orderTime: Replacement.create({
            token: 'orderTime',
            value: textPlaceholder,
        }),
        orderDate: Replacement.create({
            token: 'orderDate',
            value: textPlaceholder,
        }),
        orderMethod: Replacement.create({
            token: 'orderMethod',
            value: textPlaceholder,
        }),
        orderLocation: Replacement.create({
            token: 'orderLocation',
            value: textPlaceholder,
        }),
        orderDetailsTable: Replacement.create({
            token: 'orderDetailsTable',
            html: htmlPlaceholder,
        }),
        orderTable: Replacement.create({
            token: 'orderTable',
            html: htmlPlaceholder,
        }),
        paymentData: Replacement.create({
            token: 'paymentData',
            html: htmlPlaceholder,
        }),
        orderUrl: Replacement.create({
            token: 'orderUrl',
            value: textPlaceholder,
        }),
        webshopName: Replacement.create({
            token: 'webshopName',
            value: $t(`7c04a4f3-25c5-4663-9833-87a7aecbf0b9`),
        }),

    };
}
