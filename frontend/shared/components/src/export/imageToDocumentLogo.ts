import stamhoofdLogoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { Logo, mmToPoints, pxToPoints } from '@stamhoofd/frontend-pdf-builder';
import { Image } from '@stamhoofd/structures';

export async function imageToDocumentLogo(image: Image | null): Promise<Logo> {
    if (!image) {
        return new Logo({
            src: await (await fetch(stamhoofdLogoUrl as string)).arrayBuffer(),
            imageOptions: {
                width: mmToPoints(30),
            },
        });
    }
    const url = image.getPublicPath();
    const src = await (await fetch(url)).arrayBuffer();

    const maxHeight = mmToPoints(15);
    const maxWidth = mmToPoints(50);

    const pixelResolution: { width: number; height: number } = image.resolutions[0];
    const resolution: { width: number; height: number } = pixelResolution
        ? {
                width: pxToPoints(pixelResolution.width),
                height: pxToPoints(pixelResolution.height),
            }
        : { width: mmToPoints(30), height: mmToPoints(30) };

    let height = resolution.height;
    let width = resolution.width;

    if (height > maxHeight) {
        const ratio = width / height;
        height = maxHeight;
        width = Math.floor(height * ratio);
    }

    if (width > maxWidth) {
        const ratio = height / width;
        width = maxWidth;
        height = Math.floor(width * ratio);
    }

    return new Logo({
        src,
        imageOptions: {
            width,
            height,
        },
    });
}
