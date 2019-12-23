//go:generate protoc --proto_path=../ --go_out=plugins=grpc:.. auth/service/auth.proto
package main

import (
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"github.com/pkg/errors"
	"github.com/stamhoofd/stamhoofd/backend/auth/service"
	"google.golang.org/grpc"
	"log"
	"net"
)

const port = ":8000"

func main() {
	authServer := &server{
		databaseInfo: databaseInfo{
			dialect: "sqlite3",
			args:    []interface{}{"auth.db"},
		},
	}
	err := authServer.Setup()
	if err != nil {
		log.Fatalf("failed to setup: %+v", errors.WithStack(err))
	}

	listener, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("failed to listen: %+v", errors.WithStack(err))
	}

	grpcServer := grpc.NewServer()
	service.RegisterAuthServer(grpcServer, authServer)
	if err = grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve: %+v", errors.WithStack(err))
	}
}
