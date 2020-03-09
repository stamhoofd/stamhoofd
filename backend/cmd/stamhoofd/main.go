package main

import (
	"log"
	"os"

	"github.com/stamhoofd/stamhoofd/backend/cmd/stamhoofd/watch"
	"github.com/urfave/cli/v2"
)

func main() {
	globalFlags := []cli.Flag{
		&cli.BoolFlag{
			Name:    "verbose",
			Usage:   "Enable verbose output.",
			Aliases: []string{"debug"},
		},
	}
	app := &cli.App{
		Name:  "stamhoofd",
		Usage: "Tool for running all Stamhoofd services locally.",
		Commands: []*cli.Command{
			{
				Name:    "watch",
				Aliases: []string{"w"},
				Usage:   "Watch the backend services for changes and reload them on change. Optionally pass a directory of where the backend folder is located.",
				Action:  watch.Command,
				Flags: append(
					[]cli.Flag{
						&cli.StringSliceFlag{
							Name:    "service",
							Aliases: []string{"s"},
							Usage:   "Specify which services to build.",
						},
					},
					globalFlags...,
				),
			},
		},
		Flags: globalFlags,
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}
