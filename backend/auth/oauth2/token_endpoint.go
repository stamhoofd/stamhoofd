package oauth2

import (
	"net/http"

	"github.com/ory/fosite"
	"github.com/sirupsen/logrus"
)

// The token endpoint is usually at "https://mydomain.com/oauth2/token"
func tokenEndpoint(rw http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	mySessionData := new(fosite.DefaultSession)

	// This will create an access request object and iterate through the registered TokenEndpointHandlers to validate the request.
	accessRequest, err := oauth2Provider.NewAccessRequest(ctx, req, mySessionData)
	if err != nil {
		logrus.Errorf("request error: %v", err)
		oauth2Provider.WriteAccessError(rw, accessRequest, err)
		return
	}

	if mySessionData.Username == "super-admin-guy" {
		// do something...
	}

	// Next we create a response for the access request. Again, we iterate through the TokenEndpointHandlers
	// and aggregate the result in response.
	response, err := oauth2Provider.NewAccessResponse(ctx, accessRequest)
	if err != nil {
		logrus.Errorf("response error: %v", err)
		oauth2Provider.WriteAccessError(rw, accessRequest, err)
		return
	}

	// All done, send the response.
	oauth2Provider.WriteAccessResponse(rw, accessRequest, response)

	// The client has a valid access token now
}
