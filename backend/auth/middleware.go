package main

import (
	"context"
	"net/http"

	"github.com/stamhoofd/stamhoofd/backend/auth/models"

	"github.com/jinzhu/gorm"
)

const (
	userKey = "user"
)

// Authentication is a middleware for authenticating the user.
func Authentication(db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			email, token, ok := r.BasicAuth()
			if !ok {
				next.ServeHTTP(w, r)
				return
			}

			var user *models.User
			err := db.Where(&models.User{
				Email:             email,
				RegistrationToken: token,
			}).First(user).Error

			if err != nil {
				http.Error(w, "Invalid token", http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), userKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserContext returns the user that is currently logged in.
func UserContext(ctx context.Context) *models.User {
	raw, _ := ctx.Value(userKey).(*models.User)
	return raw
}
