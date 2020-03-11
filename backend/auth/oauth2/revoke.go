package oauth2

import (
	"net/http"

	"github.com/ory/fosite"
)

func revokeEndpoint(rw http.ResponseWriter, req *http.Request) {
	ctx := fosite.NewContext()
	err := oauth2Provider.NewRevocationRequest(ctx, req)
	oauth2Provider.WriteRevocationResponse(rw, err)
}
