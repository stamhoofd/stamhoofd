package main

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"github.com/stamhoofd/stamhoofd/backend/auth/service"
	"golang.org/x/crypto/bcrypt"
)

func NewTestServer() (*server, *gorm.DB) {
	testServer := &server{
		databaseInfo: databaseInfo{
			dialect: "sqlite3",
			args:    []interface{}{":memory:"},
		},
	}

	db, err := testServer.database()
	if err != nil {
		panic(err)
	}

	err = testServer.setup(db)
	if err != nil {
		panic(err)
	}

	return testServer, db
}

func TestRegister(t *testing.T) {
	testServer, db := NewTestServer()
	defer db.Close()

	email := "name@example.com"
	password := "password"
	request := &service.RegisterRequest{
		Email:    email,
		Password: password,
	}
	response, err := testServer.register(context.Background(), request, db)
	if err != nil {
		panic(err)
	}

	var users []models.User
	db.Find(&users)

	if len(users) != 1 {
		t.Errorf("No user was created.")
	}

	user := users[0]

	if user.Email != email {
		t.Errorf("Incorrect email address was saved.")
	}

	if response.GetUser().GetEmail() != email {
		t.Errorf("Incorrect email was returned.")
	}

	_, err = uuid.FromBytes([]byte(user.ID.String()))
	if err == nil {
		t.Errorf("Invalid UUID saved in database.")
	}

	if response.GetUser().GetId() != user.ID.String() {
		t.Errorf("UUID %s was returned, expected %s", response.GetUser().GetId(), user.ID.String())
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		t.Errorf("Stored hash does not match given password.")
	}
}
