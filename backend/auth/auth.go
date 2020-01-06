package main

import (
	"context"
	"log"

	"github.com/jinzhu/gorm"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"github.com/stamhoofd/stamhoofd/backend/auth/pb"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type server struct {
	pb.AuthServer
	DB *gorm.DB
}

func (s *server) Register(ctx context.Context, request *pb.RegisterRequest) (*pb.RegisterResponse, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.GetPassword()), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	err = SendEmail(request.GetEmail(), "Welcome to Stamhoofd!",
		"This is the welcome body!")
	if err != nil {
		log.Printf("Failed to send register email: %+v", err)
		return &pb.RegisterResponse{}, status.New(codes.Internal, "failed to send email").Err()
	}
	log.Printf("email sent to %s", request.GetEmail())

	user := &models.User{
		Email:    request.GetEmail(),
		Password: string(hashedPassword),
	}
	s.DB.Create(user)

	log.Printf("saved user to database: %v", user)
	return &pb.RegisterResponse{
		User: &pb.User{
			Id:    user.ID.String(),
			Email: user.Email,
		},
	}, nil
}

func (s *server) RegisterConfirm(_ context.Context, request *pb.RegisterConfirmRequest) (*pb.RegisterConfirmResponse, error) {
	log.Printf("Confirm email %s and token %s", request.GetEmail(), request.GetConfirmToken())
	return &pb.RegisterConfirmResponse{}, nil
}
