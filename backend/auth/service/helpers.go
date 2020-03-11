package service

import (
	"crypto/rand"
	"encoding/base64"
)

const TokenLength = 128

func GenerateToken() (string, error) {
	b := make([]byte, TokenLength)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(b), nil
}
