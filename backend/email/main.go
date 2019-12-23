//go:generate protoc --proto_path=../ --go_out=plugins=grpc:.. email/service/email.proto
package main

import (
	"log"
	"net"
	"os"

	"github.com/stamhoofd/stamhoofd/backend/email/service"
	"google.golang.org/grpc"
)

const port = ":8002"

func main() {
	emailServer := &EmailServer{
		EmailAuthentication: EmailAuthentication{
			Username: os.Getenv("EMAIL_USERNAME"),
			Password: os.Getenv("EMAIL_PASSWORD"),
			Host:     os.Getenv("EMAIL_HOST"),
			Port:     os.Getenv("EMAIL_PORT"),
		},
	}

	listener, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	service.RegisterEmailServer(grpcServer, emailServer)
	if err = grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
