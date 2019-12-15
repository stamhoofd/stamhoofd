package main

import (
	"context"
	"log"
	"time"

	authService "github.com/stamhoofd/stamhoofd/backend/auth/service"
	"google.golang.org/grpc"
)

const (
	address = "localhost:8000"
)

func main() {
	// Set up a connection to the server.
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, address, grpc.WithInsecure(), grpc.WithBlock())
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	authClient := authService.NewAuthClient(conn)

	// Start a new timeout
	ctx, cancel = context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	// Contact the server and print out its response.
	user, err := authClient.AddUser(ctx, &authService.AddUserRequest{
		Email:    "name@example.com",
		Password: "password",
	})
	if err != nil {
		log.Fatalf("could not add user: %v", err)
	}
	log.Printf("Added user: %s", user.GetUser())
}
