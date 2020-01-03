package main

import (
	"log"
	"os"

	"github.com/stamhoofd/stamhoofd/backend/cmd/stamhoofd/watch"
	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Commands: []*cli.Command{
			{
				Name:    "watch",
				Aliases: []string{"w"},
				Usage:   "Watch the backend services for changes and reload them on change. Optionally pass a directory of where the backend folder is located.",
				Action:  watch.Command,
				Flags: []cli.Flag{
					&cli.StringSliceFlag{
						Name:    "service",
						Aliases: []string{"s"},
						Usage:   "Specify which services to build.",
					},
				},
			},
		},
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}
