package service

import (
	"encoding/base64"
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

	response, err := Login(db, email, password)
	if err != nil {
		t.Fatal(err)
	}

	if response.User.ID != registeredUser.ID {
		t.Fatalf("UUID %v was returned, expected %v", response.User.ID, registeredUser.ID)
	}

	_, err = base64.URLEncoding.DecodeString(response.Token)
	if err != nil {
		t.Fatalf("no valid token generated: %v", err)
	}
}
