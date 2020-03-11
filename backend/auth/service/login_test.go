package service

import (
	"testing"
)

func TestLogin(t *testing.T) {
	db := database()
	defer db.Close()

	email := "name@example.com"
	password := "password"
	registeredUser, err := Register(db, email, password)
	if err != nil {
		t.Fatal(err)
	}

	_, err = RegisterConfirm(db, email, registeredUser.RegistrationToken)
	if err != nil {
		t.Fatal(err)
	}

	user, err := Login(db, email, password)
	if err != nil {
		t.Fatal(err)
	}

	if user.ID != registeredUser.ID {
		t.Fatalf("UUID %v was returned, expected %v", user.ID, registeredUser.ID)
	}
}
