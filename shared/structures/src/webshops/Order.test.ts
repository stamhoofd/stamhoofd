import { TranslatedString } from '../TranslatedString.js';
import { File } from '../files/File.js';
import { Image } from '../files/Image.js';
import { Resolution } from '../files/Resolution.js';
import { RecordFileAnswer, RecordImageAnswer, RecordTextAnswer } from '../members/records/RecordAnswer.js';
import { RecordCategory } from '../members/records/RecordCategory.js';
import { RecordSettings, RecordType } from '../members/records/RecordSettings.js';
import { Organization } from '../Organization.js';
import { Order, OrderData } from './Order.js';
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
});
