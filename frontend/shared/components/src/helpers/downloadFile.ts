import { SimpleError } from '@simonbackx/simple-errors';
import { AppManager } from '@stamhoofd/networking/AppManager';

/**
 * Downloads a file that is shown in the UI, instead of opening its url.
 *
 * The url of a file is not always ours: a file can point at any server (see File in @stamhoofd/structures), so
 * opening it would send the user from our own interface to a page we don't control - an easy way to phish
 * someone. We fetch the file and save the bytes instead, so a click on a file never navigates anywhere.
 *
 * This needs the file server to allow our origin (CORS). Our own file server does; a server that doesn't
 * simply fails to download, which is exactly what we want for a file we don't trust.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
    let response: Response;

    try {
        response = await fetch(url);
    } catch (error) {
        // Most likely a server that doesn't allow us to read its files
        console.error('Failed to download file', url, error);

        throw new SimpleError({
            code: 'failed_to_download',
            message: 'Failed to download file',
            human: $t('%Zgf'),
        });
    }

    if (!response.ok) {
        throw new SimpleError({
            code: 'failed_to_download',
            message: 'Failed to download file: status ' + response.status,
            human: $t('%Zgf'),
        });
    }

    await AppManager.shared.downloadFile(await response.blob(), filename);
}
