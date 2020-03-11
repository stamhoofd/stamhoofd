package oauth2

import (
	"net/http"

	"github.com/ory/fosite"
)

func tokenEndpoint(rw http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	mySessionData := new(fosite.DefaultSession)

	// Validate access.
	accessRequest, err := oauth2Provider.NewAccessRequest(ctx, req, mySessionData)
	if err != nil {
		oauth2Provider.WriteAccessError(rw, accessRequest, err)
		return
	}

	// Generate proper response to validated request.
	response, err := oauth2Provider.NewAccessResponse(ctx, accessRequest)
	if err != nil {
		oauth2Provider.WriteAccessError(rw, accessRequest, err)
		return
	}

	// Write the response.
	oauth2Provider.WriteAccessResponse(rw, accessRequest, response)
}
