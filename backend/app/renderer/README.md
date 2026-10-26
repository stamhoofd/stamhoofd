# Stamhoofd Renderer service

PDF cache reads require an API-issued signature over `pdf-cache`, the cache ID,
the exact version timestamp, and an expiry timestamp. HTML rendering signs
`html-to-pdf`, the cache ID, version timestamp, expiry, and HTML. Both grants last
at most 60 seconds; cached HTTP responses must not reuse them. The document client
always obtains a new grant through the API's current document permission check.
A grant already issued before permission revocation remains usable until expiry.
Deploy API, renderer, and document clients together: old unsigned cache requests
and non-expiring render signatures are rejected. Invoice generation uses the same
expiring render transport.
