import { TranslatedString } from '../TranslatedString.js';
import { BalanceItemPaymentWithPayment, BalanceItemWithPayments } from '../BalanceItem.js';
import { File } from '../files/File.js';
import { Image } from '../files/Image.js';
import { Resolution } from '../files/Resolution.js';
import { RecordFileAnswer, RecordImageAnswer, RecordTextAnswer } from '../members/records/RecordAnswer.js';
import { RecordCategory } from '../members/records/RecordCategory.js';
import { RecordSettings, RecordType } from '../members/records/RecordSettings.js';
import { Organization } from '../Organization.js';
import { Payment } from '../members/Payment.js';
import { PaymentMethod } from '../PaymentMethod.js';
import { PaymentStatus } from '../PaymentStatus.js';
import { PaymentType } from '../PaymentType.js';
import { Order, OrderData } from './Order.js';
import { TransferSettings } from './TransferSettings.js';
import { WebshopPreview } from './Webshop.js';
import { WebshopMetaData } from './WebshopMetaData.js';

describe('Order', () => {
    const fileRecordSettings = RecordSettings.create({
        name: TranslatedString.create('Attest'),
        type: RecordType.File,
    });

    const textRecordSettings = RecordSettings.create({
        name: TranslatedString.create('Opmerking'),
        type: RecordType.Textarea,
    });

    const imageRecordSettings = RecordSettings.create({
        name: TranslatedString.create('Foto'),
        type: RecordType.Image,
    });

    const file = new File({
        id: 'file-1',
        server: 'https://files.example.com',
        path: 'users/1/abc/attest.pdf',
        name: 'attest.pdf',
        size: 100,
    });

    const imageSource = new File({
        id: 'image-source',
        server: 'https://files.example.com',
        path: 'users/1/abc/photo.jpg',
        name: 'photo.jpg',
        size: 5000,
    });

    const imageResolutionFile = new File({
        id: 'image-600',
        server: 'https://files.example.com',
        path: 'users/1/abc/photo-600.jpg',
        size: 1000,
    });

    const image = Image.create({
        source: imageSource,
        resolutions: [new Resolution({ file: imageResolutionFile, width: 600, height: 400 })],
    });

    function createOrder() {
        const webshop = WebshopPreview.create({
            meta: WebshopMetaData.create({
                recordCategories: [
                    RecordCategory.create({
                        name: TranslatedString.create('Documenten'),
                        records: [fileRecordSettings, textRecordSettings, imageRecordSettings],
                    }),
                ],
            }),
        });

        const order = Order.create({
            webshopId: webshop.id,
            data: OrderData.create({}),
        });
        order.data.recordAnswers = new Map();
        order.data.recordAnswers.set(fileRecordSettings.id, RecordFileAnswer.create({ settings: fileRecordSettings, file }));
        order.data.recordAnswers.set(textRecordSettings.id, RecordTextAnswer.create({ settings: textRecordSettings, value: 'Een opmerking' }));
        order.data.recordAnswers.set(imageRecordSettings.id, RecordImageAnswer.create({ settings: imageRecordSettings, image }));

        return { webshop, order };
    }

    test('a file record answer shows the file name in the details table, not its url', () => {
        const { webshop, order } = createOrder();
        const html = order.getDetailsHTMLTable(webshop);

        expect(html).toContain('attest.pdf');
        expect(html).not.toContain('files.example.com');
        expect(html).toContain('Een opmerking');
    });

    test('an image record answer is rendered as an inline image that references its resolution file', () => {
        const { webshop, order } = createOrder();
        const html = order.getDetailsHTMLTable(webshop);

        expect(html).toContain('<img src="cid:image-600"');
        expect(html).toContain('alt="photo.jpg"');
        // Bounded box, aspect ratio preserved
        expect(html).toContain('style="max-width: 200px; max-height: 64px; width: auto; height: auto;"');
        expect(html).not.toContain('files.example.com');
    });

    test('the orderDetailsTable replacement contains the files of the file and image record answers', () => {
        const { webshop, order } = createOrder();
        const organization = Organization.create({});

        const recipient = order.getRecipient(organization, webshop);
        const replacement = recipient.replacements.find(r => r.token === 'orderDetailsTable')!;

        // The image uses the same resolution file the inline image references, not its full size source
        expect(replacement.files).toEqual([file, imageResolutionFile]);

        // Other replacements don't carry files
        expect(recipient.replacements.filter(r => r.files.length > 0)).toEqual([replacement]);
    });

    function createTransferOrder(...payments: Payment[]) {
        const webshop = WebshopPreview.create({});
        const order = Order.create({
            webshopId: webshop.id,
            data: OrderData.create({}),
            balanceItems: [
                BalanceItemWithPayments.create({
                    payments: payments.map(payment => BalanceItemPaymentWithPayment.create({ payment, price: payment.price })),
                }),
            ],
        });

        return { webshop, order };
    }

    function createTransferPayment(status: PaymentStatus, transferDescription: string, type = PaymentType.Payment) {
        return Payment.create({
            method: PaymentMethod.Transfer,
            status,
            type,
            price: 1000,
            transferDescription,
            transferSettings: TransferSettings.create({
                iban: 'BE71096123456769',
                creditor: 'Democlub',
            }),
        });
    }

    function getTransferReplacements(order: Order, webshop: WebshopPreview) {
        const recipient = order.getRecipient(Organization.create({}), webshop);
        return {
            transferDescription: recipient.replacements.find(r => r.token === 'transferDescription')!.value,
            transferBankAccount: recipient.replacements.find(r => r.token === 'transferBankAccount')!.value,
            transferBankCreditor: recipient.replacements.find(r => r.token === 'transferBankCreditor')!.value,
        };
    }

    // The order confirmation email is sent before the transfer is received, so the payment is not succeeded yet
    test.each([PaymentStatus.Created, PaymentStatus.Pending, PaymentStatus.Succeeded])('the transfer replacements are filled in for a %s transfer payment', (status) => {
        const { webshop, order } = createTransferOrder(createTransferPayment(status, '+++123/4567/89123+++'));

        expect(getTransferReplacements(order, webshop)).toEqual({
            transferDescription: '+++123/4567/89123+++',
            transferBankAccount: 'BE71096123456769',
            transferBankCreditor: 'Democlub',
        });
    });

    test('the transfer replacements only contain the unpaid transfer if the order was partially paid by an earlier transfer', () => {
        const { webshop, order } = createTransferOrder(
            createTransferPayment(PaymentStatus.Succeeded, '+++111/1111/11111+++'),
            createTransferPayment(PaymentStatus.Created, '+++222/2222/22222+++'),
        );

        expect(getTransferReplacements(order, webshop).transferDescription).toBe('+++222/2222/22222+++');
    });

    test('a failed transfer is never used for the transfer replacements', () => {
        const { webshop, order } = createTransferOrder();
        const failedTransfer = createTransferPayment(PaymentStatus.Failed, '+++111/1111/11111+++');

        const recipient = order.getRecipient(Organization.create({}), webshop, failedTransfer);

        expect(recipient.replacements.find(r => r.token === 'transferDescription')!.value).toBe('');
    });

    test('a refund of a transfer does not replace the payment instructions of the original transfer', () => {
        const { webshop, order } = createTransferOrder(
            createTransferPayment(PaymentStatus.Succeeded, '+++111/1111/11111+++'),
            // A refund copies the payment method, but never gets a transfer description
            createTransferPayment(PaymentStatus.Created, '', PaymentType.Refund),
        );

        expect(getTransferReplacements(order, webshop).transferDescription).toBe('+++111/1111/11111+++');
    });
});
