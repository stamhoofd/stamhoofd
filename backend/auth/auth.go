package main

import (
	"context"
	"log"

	"github.com/golang/protobuf/ptypes/any"
	"github.com/jinzhu/gorm"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"github.com/stamhoofd/stamhoofd/backend/auth/service"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/genproto/googleapis/rpc/status"
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
	user := &models.User{
		Email:    request.GetEmail(),
		Password: string(hashedPassword),
	}
	db.Create(user)

	// TODO Send an email using the email service.
	log.Printf("Added user %v", user)
	return &service.RegisterResponse{
		Status: &status.Status{
			Code:    1,
			Message: "message",
			Details: []*any.Any{},
		},
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
	return &service.RegisterConfirmResponse{
		Status: &status.Status{
			Code:    1,
			Message: "message",
			Details: []*any.Any{},
		},
	}, nil
}
