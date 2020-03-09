package service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"golang.org/x/crypto/bcrypt"
)

func TestRegister(t *testing.T) {
	db := database()
	defer db.Close()

	email := "name@example.com"
	password := "password"
	registeredUser, err := Register(db, email, password)
	if err != nil {
		t.Fatal(err)
	}

	var users []models.User
	db.Find(&users)

	if len(users) != 1 {
		t.Fatalf("No user was created.")
	}

	user := users[0]

	if user.Email != email {
		t.Fatalf("Incorrect email address was saved.")
	}

	if registeredUser.Email != email {
		t.Fatalf("Incorrect email was returned.")
	}

	_, err = uuid.FromBytes([]byte(user.ID.String()))
	if err == nil {
		t.Fatalf("Invalid UUID saved in database.")
	}

	if registeredUser.ID != user.ID {
		t.Fatalf("UUID %v was returned, expected %v", registeredUser.ID, user.ID)
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		t.Fatalf("Stored hash does not match given password.")
	}
}
