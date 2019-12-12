package main

import (
	"context"
	"log"
	"net"

	"github.com/golang/protobuf/ptypes/any"
	"github.com/stamhoofd/stamhoofd/backend/auth/service"
	"google.golang.org/genproto/googleapis/rpc/status"
	"google.golang.org/grpc"
)

const port = ":8000"

type server struct {
	service.AuthServer
}

func (s *server) AddUser(_ context.Context, request *service.AddUserRequest) (*service.AddUserResponse, error) {
	return &service.AddUserResponse{
		User: &service.User{
			Email: request.GetEmail(),
		},
		Status: &status.Status{
			Code:    1,
			Message: "message",
			Details: []*any.Any{},
		},
	}, nil
}

func main() {
	listener, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	service.RegisterAuthServer(grpcServer, &server{})
	if err = grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
