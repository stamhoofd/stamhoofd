import stamhoofdLogoUrl from '@stamhoofd/assets/images/logo/logo-horizontal.png';
import { Logo, mmToPoints, pxToPoints } from '@stamhoofd/frontend-pdf-builder';
import { Image } from '@stamhoofd/structures';

function mmToPx(mm: number): number {
    return Math.floor(mm / 3.7795275591);
}

export async function imageToDocumentLogo(image: Image | null): Promise<Logo> {
    if (!image) {
        return new Logo({
            src: await (await fetch(stamhoofdLogoUrl as string)).arrayBuffer(),
            imageOptions: {
                width: mmToPoints(30),
            },
        });
    }
    const maxHeightInMm = 15;
    const maxHeightInPx = mmToPx(maxHeightInMm);

    const url = image.getPathForSize(undefined, maxHeightInPx);

    const src = await (await fetch(url)).arrayBuffer();

    const maxHeight = mmToPoints(maxHeightInMm);
    const maxWidth = mmToPoints(50);

    const pixelResolution: { width: number; height: number } = image.getResolutionForSize(undefined, maxHeightInPx);
    const resolution: { width: number; height: number } = {
        width: pxToPoints(pixelResolution.width),
        height: pxToPoints(pixelResolution.height),
    };

    let height = resolution.height;
    let width = resolution.width;
    const ratio = height / width;

    if (height > maxHeight) {
        height = maxHeight;
        width = Math.floor(height / ratio);
    }

    if (width > maxWidth) {
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
