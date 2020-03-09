package service

import (
	"fmt"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

type running struct {
	*service
	cmd       *exec.Cmd
	waitGroup *sync.WaitGroup
	err       error
}

func Running(state State) *running {
	return &running{
		service:   state.Service(),
		waitGroup: &sync.WaitGroup{},
	}
}
func (s *running) Wait() {
	if s.cmd != nil {
		time.Sleep(time.Millisecond * 500)
		return
	}

	s.logger.Info("Running...")

	if s.HasRunCommand() {
		s.cmd = exec.Command(s.Config.RunCommand[0], s.Config.RunCommand[1:len(s.Config.RunCommand)]...)
	} else {
		s.cmd = exec.Command(s.Name)
	}
	s.cmd.Dir = s.Dir()
	s.cmd.Env = append(os.Environ(), "DEVELOPMENT=true")
	// Assign a process id group so we can kill the whole process group.
	s.cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	for key, value := range s.Config.Env {
		s.cmd.Env = append(s.cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}

	s.err = s.runCommand(s.cmd, false, s.waitGroup)
}

func (s *running) Consume(action interface{}) State {
	switch action.(type) {
	case Nothing:
		if s.err != nil {
			s.logger.Debug("Nothing requested, but stopped.")
			return Stopped(s, s.err)
		}
		return s
	case Restart:
		if s.err != nil {
			s.logger.Debug("Restart requested, but stopped.")
			return Starting(s)
		}
		return Restarting(s, s.cmd, s.waitGroup)
	case Stop:
		s.logger.Debug("Stop requested from running.")
		return Stopping(s, s.cmd, s.waitGroup)
	case End:
		s.logger.Debug("End requested from running.")
		return Ending(s, s.cmd, s.waitGroup)
	default:
		return InvalidAction(s, action)
	}
}
