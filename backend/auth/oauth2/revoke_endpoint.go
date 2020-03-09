package oauth2

import (
	"net/http"

	"github.com/ory/fosite"
)

func revokeEndpoint(rw http.ResponseWriter, req *http.Request) {
	// This context will be passed to all methods.
	ctx := fosite.NewContext()

	// This will accept the token revocation request and validate various parameters.
	err := oauth2Provider.NewRevocationRequest(ctx, req)

	// All done, send the response.
	oauth2Provider.WriteRevocationResponse(rw, err)
}
