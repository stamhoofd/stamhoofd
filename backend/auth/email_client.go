package main

import (
	"context"
	"log"
	"time"

	email "github.com/stamhoofd/stamhoofd/backend/email/service"
	"google.golang.org/grpc"
)

const (
	address = "localhost:8002"
)

func SendEmail(to, subject, body string) error {
	// Set up a connection to the server.
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, address, grpc.WithInsecure(), grpc.WithBlock())
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	emailClient := email.NewEmailClient(conn)

	// Start a new timeout
	ctx, cancel = context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	// Contact the server and print out its response.
	_, err = emailClient.Send(ctx, &email.SendRequest{
		To:      to,
		Subject: subject,
		Body:    body,
	})
	return err
}
