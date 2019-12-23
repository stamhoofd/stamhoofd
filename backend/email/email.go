package main

import (
	"context"
	"fmt"
	"log"
	"net/smtp"

	"github.com/golang/protobuf/ptypes/empty"
	"github.com/stamhoofd/stamhoofd/backend/email/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type EmailServer struct {
	service.EmailServer
	EmailAuthentication
}

type EmailAuthentication struct {
	Username string
	Password string
	Host     string
	Port     string
}

func (s *EmailServer) Send(_ context.Context, request *service.SendRequest) (*empty.Empty, error) {
	log.Printf("Sending email '%s' to %s...", request.GetSubject(), request.GetTo())

	// TODO Return before sending the email as it takes too long.
	auth := smtp.PlainAuth("", s.Username, s.Password, s.Host)
	to := []string{request.GetTo()}
	msg := "Subject: " + request.GetSubject() + "\n" + request.GetBody()
	err := smtp.SendMail(fmt.Sprintf("%s:%s", s.Host, s.Port), auth, s.Username, to, []byte(msg))
	if err != nil {
		log.Printf("error: %v", err)
		return &empty.Empty{}, status.New(codes.Unknown, err.Error()).Err()
	}

	log.Printf("message sent to %s", request.GetTo())

	return &empty.Empty{}, nil
}

func (s *EmailServer) SendUser(_ context.Context, request *service.SendUserRequest) (*empty.Empty, error) {
	return &empty.Empty{}, nil
}
