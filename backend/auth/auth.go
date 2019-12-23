package main

import (
	"context"
	"log"

	"github.com/jinzhu/gorm"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"github.com/stamhoofd/stamhoofd/backend/auth/service"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type server struct {
	service.AuthServer
	databaseInfo
}

type databaseInfo struct {
	dialect string
	args    []interface{}
}

func (s *server) setup(db *gorm.DB) error {
	db.AutoMigrate(&models.User{})
	return nil
}

func (s *server) Setup() error {
	db, err := s.database()
	if err != nil {
		return err
	}
	defer db.Close()
	return s.setup(db)
}

func (s *server) database() (*gorm.DB, error) {
	return gorm.Open(s.dialect, s.args...)
}

func (s *server) register(_ context.Context, request *service.RegisterRequest, db *gorm.DB) (*service.RegisterResponse, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.GetPassword()), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	err = SendEmail(request.GetEmail(), "Welcome to Stamhoofd!",
		"This is the welcome body!")
	if err != nil {
		log.Printf("Failed to send register email: %+v", err)
		return &service.RegisterResponse{}, status.New(codes.Internal, "failed to send email").Err()
	}
	log.Printf("email sent to %s", request.GetEmail())

	user := &models.User{
		Email:    request.GetEmail(),
		Password: string(hashedPassword),
	}
	db.Create(user)

	log.Printf("saved user to database: %v", user)
	return &service.RegisterResponse{
		User: &service.User{
			Id:    user.ID.String(),
			Email: user.Email,
		},
	}, nil
}

func (s *server) Register(ctx context.Context, request *service.RegisterRequest) (*service.RegisterResponse, error) {
	db, err := s.database()
	if err != nil {
		return nil, err
	}
	defer db.Close()
	return s.register(ctx, request, db)
}

func (s *server) RegisterConfirm(_ context.Context, request *service.RegisterConfirmRequest) (*service.RegisterConfirmResponse, error) {
	log.Printf("Confirm email %s and token %s", request.GetEmail(), request.GetConfirmToken())
	return &service.RegisterConfirmResponse{}, nil
}
