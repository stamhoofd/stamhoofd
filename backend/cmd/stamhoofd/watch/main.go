package watch

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/sirupsen/logrus"
	"github.com/stamhoofd/stamhoofd/backend/cmd/stamhoofd/watch/service"
	"github.com/urfave/cli/v2"
	prefixed "github.com/x-cray/logrus-prefixed-formatter"
)

const (
	defaultBackendDir string = "."
)

func Command(c *cli.Context) error {
	backendDir := c.Args().Get(0)
	if len(backendDir) == 0 {
		backendDir = defaultBackendDir
	}

	serviceNames := c.StringSlice("service")

	log := logrus.New()
	log.Formatter = new(prefixed.TextFormatter)
	if c.Bool("verbose") {
		log.Level = logrus.DebugLevel
	} else {
		log.Level = logrus.InfoLevel
	}
	services := service.GetServices(log, backendDir, serviceNames)

	// Gracefully stop all of the services when it receives a SIGTERM signal.
	terminate := make(chan os.Signal, 1)
	signal.Notify(terminate, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-terminate
		log.Println("Ending all services...")
		for _, service := range services {
			service.End()
		}
		os.Exit(0)
	}()

	for _, service := range services {
		go service.Start()
	}

	done := make(chan bool)
	<-done

	return nil
}
