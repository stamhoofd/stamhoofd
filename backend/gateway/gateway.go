package main

import (
	"fmt"
	"github.com/nautilus/gateway"
	"github.com/nautilus/graphql"
	"net/http"
)

func main() {
	schemas, err := graphql.IntrospectRemoteSchemas(
		"http://localhost:9000",
	)
	if err != nil {
		panic(err)
	}

	gw, err := gateway.New(schemas)
	if err != nil {
		panic(err)
	}

	http.HandleFunc("/", gw.GraphQLHandler)

	fmt.Println("Starting server")
	err = http.ListenAndServe(":3000", nil)
	if err != nil {
		fmt.Println(err.Error())
	}
}
