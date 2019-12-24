package main

import (
	"context"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc"
	"github.com/stamhoofd/stamhoofd/backend/auth/service"
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
		return errors.Wrap(err, "Can't connect with email service")
	}
	defer conn.Close()
	emailClient := service.NewEmailClient(conn)

	// Start a new timeout
	ctx, cancel = context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	// Contact the server and print out its response.
	_, err = emailClient.Send(ctx, &service.SendRequest{
		To:      to,
		Subject: subject,
		Body:    body,
	})
	return err
}
