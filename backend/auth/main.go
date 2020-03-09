//go:generate protoc --proto_path=../protos/stamhoofd --go_out=plugins=grpc:pb auth.proto email.proto
package main

import (
	"log"
	"net"
	"net/http"
	"os"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/go-chi/chi"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"github.com/stamhoofd/stamhoofd/backend/auth/graphql"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"github.com/stamhoofd/stamhoofd/backend/auth/oauth2"
	"github.com/stamhoofd/stamhoofd/backend/auth/pb"
	"google.golang.org/grpc"
)

func main() {
	// Remove timestamp information when ran from watch command.
	if _, dev := os.LookupEnv("DEVELOPMENT"); dev {
		log.SetFlags(0)
	}
	defer db.Close()

	db, err := gorm.Open("sqlite3", ":memory:")
	if err != nil {
		logrus.Fatal(err)
	}
	defer db.Close()

	db.AutoMigrate(&models.User{})

	go ServeGrpc(db)

	router := chi.NewRouter()
	ServeGraphQL(db, router)
	ServeStatus(router)
	oauth2.ServeOAuth2(router)

	log.Printf("HTTP Server listening on http://localhost%s", os.Getenv("HTTP_PORT"))
	go log.Fatal(http.ListenAndServe(os.Getenv("HTTP_PORT"), router))

	done := make(chan bool)
	<-done
}

func ServeGrpc(db *gorm.DB) {
	authServer := &server{
		DB: db,
	}

	// listener, err
	_, err := net.Listen("tcp", os.Getenv("GRPC_PORT"))
	if err != nil {
		log.Fatalf("failed to listen: %+v", errors.WithStack(err))
	}

	grpcServer := grpc.NewServer()
	pb.RegisterAuthServer(grpcServer, authServer)

	// log.Println("Starting auth service...")
	// if err = grpcServer.Serve(listener); err != nil {
	// 	log.Fatalf("failed to serve: %+v", errors.WithStack(err))
	// }
}

func ServeGraphQL(db *gorm.DB, router *chi.Mux) {
	// router.Use(Authentication(db))

	server := handler.NewDefaultServer(
		graphql.NewExecutableSchema(
			graphql.Config{
				Resolvers: &graphql.Resolver{
					DB: db,
				},
			},
		),
	)
	router.Handle("/", server)
}

func ServeStatus(router *chi.Mux) {
	router.Handle("/readiness", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	router.Handle("/liveness", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
}
