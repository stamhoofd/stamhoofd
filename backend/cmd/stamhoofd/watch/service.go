package watch

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/sirupsen/logrus"
)

const (
	Interval       = time.Millisecond * 250
	ProtobufOutput = "pb"
)

type ServiceEvent int

const (
	Restart ServiceEvent = iota
	GenerateProtos
	GenerateGraphQL
)

type Service struct {
	// Name of the service, its root folder.
	Name string
	// Folders inside of the service folder that need to be watched.
	Folders []string
	// Currently running command.
	Cmd *exec.Cmd
	// Whether the service is currently running.
	IsRunning bool
	// Service configuration.
	Config *Config
	// List of all services.
	Services map[string]*Service

	// Channel to send service events.
	eventChannel  chan ServiceEvent
	debounceTimer *time.Timer
	queuedEvents  *sync.Map

	// Channel to wait for the process to end after being killed/stopped.
	waitChannel chan error

	logger     *logrus.Entry
	backendDir string
}

// GetServices gets the list of services that have a configuration file.
// Specify a service name to only retrieve a single service.
func GetServices(log *logrus.Logger, backendDir string, serviceNames []string) map[string]*Service {
	services := make(map[string]*Service)
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
			service := NewService(log, backendDir, path, config, services)
			services[service.Name] = service
		}
		return nil
	})
	return services
}

// NewServices creates a new service.
func NewService(log *logrus.Logger, backendDir, path string, config *Config, services map[string]*Service) *Service {
	name := filepath.Base(path)
	s := &Service{
		Name:       name,
		Config:     config,
		Services:   services,
		backendDir: backendDir,
		logger: log.WithFields(logrus.Fields{
			"prefix": strings.ToUpper(name),
		}),
		waitChannel:  make(chan error),
		queuedEvents: new(sync.Map),
	}

	s.initEventDebounce()
	s.initFolders()

	return s
}

// Dir returns the service's backend directory.
func (s *Service) Dir() string {
	return filepath.Join(s.backendDir, s.Name)
}

// Init initializes the Service by creating a restart channel that is debounced
// with a timer of the interval `Interval`.
func (s *Service) initEventDebounce() {
	s.eventChannel = make(chan ServiceEvent)
	// Do not start the timer here. There is no other more convenient way:
	// https://github.com/golang/go/issues/12721
	// https://go-review.googlesource.com/c/go/+/14871/1/src/time/sleep.go
	s.debounceTimer = time.NewTimer(math.MaxInt64)

	go func() {
		for {
			select {
			case event := <-s.eventChannel:
				s.queuedEvents.Store(event, true)
				s.debounceTimer.Reset(Interval)
			case <-s.debounceTimer.C:
				s.queuedEvents.Range(func(key, value interface{}) bool {
					switch key {
					case Restart:
						s.ForceRestart()
					case GenerateProtos:
						s.ForceGenerateProtos()
					case GenerateGraphQL:
						s.ForceGenerateGraphQL()
					}
					return true
				})
				s.queuedEvents = new(sync.Map)
			}
		}
	}()
}

// initFolders adds all of the folders that need to be watched to Service.Folders
// because watching a folder is not recursive.
func (s *Service) initFolders() {
	filepath.Walk(filepath.Join(s.backendDir, s.Name), func(path string, info os.FileInfo, err error) error {
		if info.IsDir() {
			s.Folders = append(s.Folders, path)
		}
		return nil
	})
}

// Starts starts the service by running `go install` and then running the
// installed binary. This because `go run` creates a child process that can be
// hard to kill. Even when setting the group process id there can be a race
// condition leading to the child process not being killed.
func (s *Service) Start() {
	defer func() {
		go func() {
			var err error = nil
			if s.Cmd != nil {
				err = s.Cmd.Wait()
			}
			s.IsRunning = false
			s.waitChannel <- err
		}()
	}()

	if s.IsRunning {
		return
	}

	// Check whether the dependencies are ready to receive requests.
	dependencies := s.Dependencies()
	dependenciesRunning := &sync.WaitGroup{}
	dependenciesRunning.Add(len(dependencies))

	for _, dependency := range dependencies {
		go func(dependency *Service) {
			if !dependency.IsReady() {
				s.logger.Infof("Waiting for %s to be ready...", dependency.Name)
			}
			for !dependency.IsReady() {
				time.Sleep(time.Millisecond)
			}
			dependenciesRunning.Done()
		}(dependency)
	}

	s.logger.Info("Installing...")
	installCmd := exec.Command("go", "install", ".")
	installCmd.Dir = s.Dir()
	out, err := installCmd.CombinedOutput()

	outBuffer := bufio.NewReader(bytes.NewReader(out))
	if err != nil {
		for {
			line, err := outBuffer.ReadString('\n')
			if err == io.EOF {
				break
			} else if err != nil {
				s.logger.Fatal(err)
			}
			s.logger.Error(strings.TrimSuffix(line, "\n"))
		}
		s.logger.Error(err)
		return
	}

	s.logger.Info("Running...")
	s.IsRunning = true
	s.Cmd = exec.Command(s.Name)
	s.Cmd.Dir = s.Dir()
	s.Cmd.Env = os.Environ()

	for key, value := range s.Config.Env {
		s.Cmd.Env = append(s.Cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}

	// The dependencies should be ready before running the service.
	dependenciesRunning.Wait()
	wrapStartCmd(s.Cmd, s.logger, false)
}

// wrapStartCmd wraps an *exec.Cmd and pipes its output to logrus.
// The wait command specifies whether or not to wait for the command to complete.
func wrapStartCmd(cmd *exec.Cmd, logger *logrus.Entry, wait bool) {
	cmdOutput, err := cmd.StderrPipe()
	if err != nil {
		logger.Error(err)
		logger.Fatal("Could not pipe stderr.")
	}

	if err := cmd.Start(); err != nil {
		logger.Error(err)
		logger.Fatal("Could not start command: %v", cmd)
	}

	waitGroup := &sync.WaitGroup{}

	if wait {
		waitGroup.Add(1)
	}

	go func(cmdOutput io.ReadCloser, waitGroup *sync.WaitGroup, wait bool) {
		scanner := bufio.NewScanner(cmdOutput)
		for scanner.Scan() {
			logger.Info(scanner.Text())
		}
		if err = scanner.Err(); err != nil {
			logger.Error(err)
			logger.Error("An error occurred when piping the output to the logger.")
		}
		if wait {
			waitGroup.Done()
		}
	}(cmdOutput, waitGroup, wait)

	waitGroup.Wait()
}

// Kill kills the process that is currently running and its children of the same
// pgid. See *Service.Start.
func (s *Service) Stop() {
	defer func() {
		// Wait for the process to actually stop before returning as it might
		// not be immediate.
		<-s.waitChannel
	}()
	if !s.IsRunning {
		return
	}

	s.logger.Info("Stopping...")
	if err := s.Cmd.Process.Kill(); err != nil {
		s.logger.Error(err)
		s.logger.Fatalf("Could not stop")
	}

	s.Cmd = nil
}

// Restart sends a message on the event channel indicating that a restart is requested.
func (s *Service) Restart() {
	s.eventChannel <- Restart
}

// GenerateProtos sends a message on the event channel indicating that the
// protobuf files need to be regenerated.
func (s *Service) GenerateProtos() {
	s.eventChannel <- GenerateProtos
}

// GenerateGraphQL sends a message on the event channel indicating that the
// graphql files need to be regenerated.
func (s *Service) GenerateGraphQL() {
	s.eventChannel <- GenerateGraphQL
}

// Immediately stop and start the service.
// Please use *Service.Restart instead.
func (s *Service) ForceRestart() {
	s.Stop()
	s.Start()
}

// GenerateProtos generates the needed protobuf files.
// Please use *Service.GenerateProtos instead.
func (s *Service) ForceGenerateProtos() {
	s.logger.Info("Generating protobuf code...")

	args := []string{
		"--proto_path=../protos/stamhoofd", fmt.Sprintf("--go_out=plugins=grpc:%s", ProtobufOutput),
	}
	args = append(args, s.Config.Protos...)

	cmd := exec.Command("protoc", args...)
	cmd.Dir = s.Dir()
	wrapStartCmd(cmd, s.logger, true)
}

// GenerateProtos generates the needed protobuf files.
// Please use *Service.GenerateProtos instead.
func (s *Service) ForceGenerateGraphQL() {
	s.logger.Info("Generating graphql code...")

	cmd := exec.Command("go", "run", "scripts/gqlgen.go", "-v")
	cmd.Dir = s.Dir()
	wrapStartCmd(cmd, s.logger, true)
}

// Watch watches both the service's folder and protobuf files and restarts and
// generates the protobuf files again when a change is detected.
func (s *Service) Watch() {
	s.ForceGenerateProtos()
	s.Start()

	s.watchFolder()
	s.watchProtos()
}

// IsReady returns true when the container is ready to receive requests.
func (s *Service) IsReady() bool {
	return s.okResponse(fmt.Sprintf("http://localhost%s/readiness", s.Config.StatusPort()))
}

// IsAlive returns true when the container is alive, false means that it needs to be restarted.
func (s *Service) IsAlive() bool {
	return s.okResponse(fmt.Sprintf("http://localhost%s/liveness", s.Config.StatusPort()))
}

// okResponse returns true when there was no error` requesting the given URL and
// the status code was successful (>= 200 and < 400).
func (s *Service) okResponse(url string) bool {
	resp, err := http.Get(url)
	if err != nil {
		return false
	}

	return resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusBadRequest
}

// Dependencies returns the list of services this service depends on.
func (s *Service) Dependencies() []*Service {
	dependencies := []*Service{}
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

// watchFolder watches the service's files and automatically restarts the service
// when a file changes, optionally generating code like GraphQL.
func (s *Service) watchFolder() {
	err := watchPaths(func(event fsnotify.Event) {
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
func (s *Service) watchProtos() {
	protosDir := filepath.Join(s.backendDir, "protos", "stamhoofd")
	protoFiles := []string{}

	for _, protoFile := range s.Config.Protos {
		protoFiles = append(protoFiles, filepath.Join(protosDir, protoFile))
	}

	err := watchPaths(func(event fsnotify.Event) {
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
