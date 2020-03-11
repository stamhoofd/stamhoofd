package oauth2

import (
	"net/http"

	"github.com/ory/fosite"
)

func introspectionEndpoint(rw http.ResponseWriter, req *http.Request) {
	ctx := fosite.NewContext()
	mySessionData := newSession("")
	ir, err := oauth2Provider.NewIntrospectionRequest(ctx, req, mySessionData)
	if err != nil {
		oauth2Provider.WriteIntrospectionError(rw, err)
		return
	}

	oauth2Provider.WriteIntrospectionResponse(rw, ir)
}
