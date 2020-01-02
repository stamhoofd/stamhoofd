package main

import (
	"fmt"
	"github.com/nautilus/gateway"
	"github.com/nautilus/graphql"
	"net/http"
)

func main() {
	// introspect the apis
	schemas, err := graphql.IntrospectRemoteSchemas(
		"http://localhost:9000",
		// "http://localhost:3001",
	)
	if err != nil {
		panic(err)
	}

	// create the gateway instance
	gw, err := gateway.New(schemas)
	if err != nil {
		panic(err)
	}

	// add the playground endpoint to the router
	http.HandleFunc("/graphql", gw.PlaygroundHandler)

	// start the server
	fmt.Println("Starting server")
	err = http.ListenAndServe(":3000", nil)
	if err != nil {
		fmt.Println(err.Error())
	}
}
