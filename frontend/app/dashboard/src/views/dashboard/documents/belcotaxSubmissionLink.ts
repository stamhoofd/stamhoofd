import { UrlHelper } from '@stamhoofd/networking/UrlHelper';

const parameter = 'belcotax_submission';
let handled = false;

/**
 * The emails about a submission link to its template with `?belcotax_submission=<id>`. Returns that id once, so
 * the submission doesn't open again when the template is opened later on.
 */
export function takeBelcotaxSubmissionFromUrl(): string | null {
    if (handled) {
        return null;
    }
    handled = true;

    const id = UrlHelper.initial.getSearchParams().get(parameter);
    if (!id) {
        return null;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete(parameter);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    return id;
}
