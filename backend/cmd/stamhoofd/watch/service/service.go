package service

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const (
	ProtobufOutput = "pb"
)

type service struct {
	// Name of the service, its root folder.
	Name string
	// Folders inside of the service folder that need to be watched.
	Folders []string
	// Service configuration.
	Config Config
	// List of all services.
	Services map[string]*service

	// File watcher.
	watcher *watcher

	logger     *logrus.Entry
	backendDir string

	debouncer *debouncer

	actions     chan interface{}
	endGroup    *sync.WaitGroup
	isDoneMutex *sync.Mutex
	IsDone      bool
}

// GetServices gets the list of services that have a configuration file.
// Specify a service name to only retrieve a single service.
func GetServices(log *logrus.Logger, backendDir string, serviceNames []string) map[string]*service {
	services := make(map[string]*service)
	filepath.Walk(backendDir, func(path string, info os.FileInfo, err error) error {
		if info.IsDir() {
			// Skip if only a single service is requested and it's not this one.
			if serviceNames != nil {
				found := false
				for _, serviceName := range serviceNames {
					if info.Name() == serviceName {
						found = true
					}
				}
				if !found {
					return nil
				}
			}

			config, err := NewConfig(path)
			if err != nil {
				return nil
			}
			name := filepath.Base(path)
			service := Service(name, backendDir, config, log, services)
			services[service.Name] = service
		}
		return nil
	})
	return services
}

func Service(name, backendDir string, config *Config, log *logrus.Logger, services map[string]*service) *service {
	folders := []string{}
	filepath.Walk(filepath.Join(backendDir, name), func(path string, info os.FileInfo, err error) error {
		if info.IsDir() {
			if info.Name() == "node_modules" {
				return filepath.SkipDir
			}
			folders = append(folders, path)
		}
		return nil
	})

	logger := log.WithFields(logrus.Fields{
		"prefix": strings.ToUpper(name),
	})

	s := &service{
		Name:        name,
		Folders:     folders,
		Config:      *config,
		Services:    services,
		watcher:     Watcher(logger),
		backendDir:  backendDir,
		logger:      logger,
		debouncer:   Debouncer(logger, time.Millisecond*250),
		actions:     make(chan interface{}),
		endGroup:    &sync.WaitGroup{},
		isDoneMutex: &sync.Mutex{},
		IsDone:      false,
	}
	s.watchFolder()
	s.watchProtos()
	return s
}

func (s *service) Service() *service {
	return s
}

func (s *service) DefaultAction() interface{} {
	return Nothing{}
}

func (s *service) HasDependencies() bool {
	return len(s.Config.Dependencies) > 0
}

func (s *service) HasRunCommand() bool {
	return len(s.Config.RunCommand) > 0
}

// Dependencies returns the list of services this service depends on.
func (s *service) Dependencies() []*service {
	dependencies := []*service{}
	for _, dependencyName := range s.Config.Dependencies {
		for serviceName, service := range s.Services {
			if dependencyName == serviceName {
				dependencies = append(dependencies, service)
				break
			}
		}
	}
	return dependencies
}

func (s *service) Dir() string {
	return filepath.Join(s.backendDir, s.Name)
}

// IsReady returns true when the container is ready to receive requests.
func (s *service) IsReady() bool {
	return s.okResponse(fmt.Sprintf("http://localhost%s/readiness", s.Config.HTTPPort()))
}

// IsAlive returns true when the container is alive, false means that it needs to be restarted.
func (s *service) IsAlive() bool {
	return s.okResponse(fmt.Sprintf("http://localhost%s/liveness", s.Config.HTTPPort()))
}

// okResponse returns true when there was no error` requesting the given URL and
// the status code was successful (>= 200 and < 400).
func (s *service) okResponse(url string) bool {
	resp, err := http.Get(url)
	if err != nil {
		return false
	}

	return resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusBadRequest
}

func (s *service) Start() {
	s.endGroup.Add(1)

	go func() {
		s.logger.Debug("Starting")
		var state State
		state = Initializing(s)
	Loop:
		for {
			state.Wait()
			// Keep running until an invalid state is returned.
			switch state.(type) {
			case *ended, *invalid:
				break Loop
			default:
				action := s.Action(state)
				state = state.Consume(action)
			}
		}
		s.isDoneMutex.Lock()
		s.IsDone = true
		s.isDoneMutex.Unlock()
		s.endGroup.Done()
	}()
}

func (s *service) Action(state State) interface{} {
	select {
	case action := <-s.actions:
		s.logger.Debugf("Received %T", action)
		return action
	default:
		return state.DefaultAction()
	}
}

func (s *service) sendAction(action interface{}) {
	s.logger.Debug("Locking isDoneMutex")
	s.isDoneMutex.Lock()
	defer func() {
		s.logger.Debug("Unlocking isDoneMutex")
		s.isDoneMutex.Unlock()
		s.logger.Debug("Unlocked isDoneMutex")
	}()

	if s.IsDone {
		s.logger.Debug("Action requested, but already done.")
		return
	}

	s.logger.Debugf("Sending %T", action)
	s.actions <- action
	s.logger.Debugf("Done sending %T", action)
}

func (s *service) Stop() {
	s.sendAction(Stop{})
}

func (s *service) End() {
	s.sendAction(End{})
	s.endGroup.Wait()
}

func (s *service) Restart() {
	s.debouncer.Debounce("restart", func() {
		s.sendAction(Restart{})
	})

}

func (s *service) GenerateGraphQL() {
	s.debouncer.Debounce("graphql", func() {
		// Do not generate GraphQL if the settings file is not there.
		_, err := os.Stat(filepath.Join(s.Dir(), "gqlgen.yml"))
		if os.IsNotExist(err) {
			return
		}

		s.logger.Info("Generating graphql code...")

		cmd := exec.Command("go", "run", "scripts/gqlgen.go", "--verbose")
		cmd.Dir = s.Dir()
		s.runCommand(cmd, true, nil)
	})

}

func (s *service) GenerateProtos() {
	s.debouncer.Debounce("protos", func() {
		s.logger.Info("Generating protobuf code...")

		args := []string{
			"--proto_path=../protos/stamhoofd", fmt.Sprintf("--go_out=plugins=grpc:%s", ProtobufOutput),
		}
		args = append(args, s.Config.Protos...)

		cmd := exec.Command("protoc", args...)
		cmd.Dir = s.Dir()
		s.runCommand(cmd, true, nil)
	})

}

// watchFolder watches the service's files and automatically restarts the service
// when a file changes, optionally generating code like GraphQL.
func (s *service) watchFolder() {
	s.logger.Debugf("Watching folders: %v", s.Folders)
	err := s.watcher.watchPaths(func(event fsnotify.Event) {
		s.logger.WithField(
			"prefix",
			strings.ToUpper(fmt.Sprintf("%s %v", s.Name, event.Op)),
		).Info(event.Name)

		isProtoRemoved := filepath.Base(filepath.Dir(event.Name)) == ProtobufOutput && event.Op&(fsnotify.Rename|fsnotify.Remove) != 0
		if isProtoRemoved {
			s.GenerateProtos()
			return
		}

		isGraphQL := filepath.Ext(event.Name) == ".graphql"
		if isGraphQL {
			s.GenerateGraphQL()
			return
		}

		s.Restart()
	}, func(err error) {
		s.logger.Error(err)
		s.Stop()
	}, s.Folders...)

	if err != nil {
		s.logger.Fatal(err)
	}
}

// watchProtos watches the protobuf files that the service depends on and builds
// them when they change.
func (s *service) watchProtos() {
	protosDir := filepath.Join(s.backendDir, "protos", "stamhoofd")
	s.logger.Debugf("Watching protos: %s", protosDir)
	protoFiles := []string{}

	for _, protoFile := range s.Config.Protos {
		protoFiles = append(protoFiles, filepath.Join(protosDir, protoFile))
	}

	err := s.watcher.watchPaths(func(event fsnotify.Event) {
		s.logger.WithField(
			"prefix",
			strings.ToUpper(fmt.Sprintf("%s %v", s.Name, event.Op)),
		).Info(event.Name)
		s.GenerateProtos()
	}, func(err error) {
		s.logger.Info("error:", err)
		s.Stop()
	}, protoFiles...)

	if err != nil {
		s.logger.Fatal(err)
	}
}

// runCommand wraps an *exec.Cmd and pipes its output to logrus.
// The wait command specifies whether or not to wait for the command to complete.
func (s *service) runCommand(cmd *exec.Cmd, wait bool, waitGroup *sync.WaitGroup) error {
	if wait && waitGroup != nil {
		return errors.New("Cannot set wait to true and give a custom waitGroup.")
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return errors.Wrap(err, "Could not pipe stdout.")
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return errors.Wrap(err, "Could not pipe stderr.")
	}

	if err := cmd.Start(); err != nil {
		return errors.Wrap(err, fmt.Sprintf("Could not start command: %v", cmd))
	}

	if waitGroup == nil {
		waitGroup = &sync.WaitGroup{}
	}

	waitGroup.Add(2)

	wrapOutput := func(output io.ReadCloser) {
		scanner := bufio.NewScanner(output)
		for scanner.Scan() {
			s.logger.Info(scanner.Text())
		}
		if err = scanner.Err(); err != nil {
			s.logger.Error(err)
			s.logger.Error("An error occurred when piping the output to the logger.")
		}
		waitGroup.Done()
	}

	go wrapOutput(stderr)
	go wrapOutput(stdout)

	if wait {
		waitGroup.Wait()
	}
	return nil
}
