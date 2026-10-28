import type { Decoder } from '@common/encoding';
import { SimpleError } from '@common/errors';
import { Request } from '@common/networking';
import { Image, ResolutionRequest, Version } from '@stamhoofd/structures';
import { ref } from 'vue';

import { useRequestOwner } from './networking/useRequestOwner';
import { useContext } from './useContext.ts';

const maxFileSize = 5 * 1024 * 1024;

/**
 * Uploads a single image file to /upload-image and returns the resulting Image.
 * Throws a SimpleError when the file is too large or is not an image.
 */
export function useImageUpload(options: { resolutions: () => ResolutionRequest[] | null; isPrivate?: () => boolean }) {
    const context = useContext();
    const owner = useRequestOwner();
    const uploading = ref(false);

    async function upload(file: File): Promise<Image> {
        if (!file.type.startsWith('image/')) {
            throw new SimpleError({
                code: 'invalid_file_type',
                message: $t('%Zy8'),
            });
        }

        if (file.size > maxFileSize) {
            throw new SimpleError({
                code: 'file_too_large',
                message: $t('%z3'),
            });
        }

        const resolutions = options.resolutions() ?? [ResolutionRequest.create({ height: 720 })];

        const formData = new FormData();
        formData.append('file', file);
        formData.append('resolutions', JSON.stringify(resolutions.map(r => r.encode({ version: Version }))));

        Request.cancelAll(owner);
        uploading.value = true;

        try {
            const response = await context.value.optionalAuthenticatedServer.request({
                method: 'POST',
                path: '/upload-image',
                body: formData,
                decoder: Image as Decoder<Image>,
                timeout: 60 * 1000,
                shouldRetry: false,
                owner,
                query: {
                    private: options.isPrivate?.() ? true : undefined,
                },
            });
            return response.data;
        } finally {
            uploading.value = false;
        }
    }

    return { uploading, upload };
}
