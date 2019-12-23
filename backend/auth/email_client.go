package main

import (
	"context"
	"time"

	"github.com/pkg/errors"
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
		return errors.Wrap(err, "Can't connect with email service")
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
