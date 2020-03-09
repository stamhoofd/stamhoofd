package service

import (
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/pkg/errors"
)

type stopping struct {
	*service
	// Input
	cmd        *exec.Cmd
	waitGroup  *sync.WaitGroup
	nextAction interface{}

	// Output
	err       error
	isStopped bool
	interval  time.Duration

	first bool
}

func Stopping(state State, cmd *exec.Cmd, waitGroup *sync.WaitGroup) State {
	return &stopping{
		service:    state.Service(),
		cmd:        cmd,
		waitGroup:  waitGroup,
		nextAction: nil,
		isStopped:  false,
	}
}

func Restarting(state State, cmd *exec.Cmd, waitGroup *sync.WaitGroup) State {
	return &stopping{
		service:    state.Service(),
		cmd:        cmd,
		waitGroup:  waitGroup,
		nextAction: Start{},
		isStopped:  false,
	}
}

func Ending(state State, cmd *exec.Cmd, waitGroup *sync.WaitGroup) State {
	return &stopping{
		service:    state.Service(),
		cmd:        cmd,
		waitGroup:  waitGroup,
		nextAction: End{},
		isStopped:  false,
	}
}

func (s *stopping) Wait() {
	if !s.first {
		s.first = true

		go func() {
			s.waitGroup.Wait()
			s.isStopped = true
		}()
	}
	if s.cmd == nil {
		if s.interval == time.Duration(0) {
			s.interval = time.Millisecond * 100
		} else {
			s.interval *= 2
			if s.interval > time.Second {
				s.interval = time.Second
			}
		}
		time.Sleep(s.interval)
		return
	}

	s.logger.Info("Stopping...")

	// Kill the entire process group.
	// Yarn for example spawns different processes and this would kill them all.
	if err := syscall.Kill(-s.cmd.Process.Pid, syscall.SIGKILL); err != nil {
		s.err = errors.Wrap(err, "Could not stop.")
		return
	}
	s.cmd = nil
}

func (s *stopping) DefaultAction() interface{} {
	return s.nextAction
}

func (s *stopping) Consume(action interface{}) State {
	if s.err != nil {
		s.logger.Debug("Error occurred while stopping.")
		return Invalid(s, s.err)
	}

	if !s.isStopped {
		s.logger.Info("Still stopping...")
		return s
	}

	switch action.(type) {
	case Nothing, Stop:
		s.logger.Debug("Stopping succesful")
		return Stopped(s, nil)
	case End:
		return Ended(Stopped(s, nil))
	case Start:
		return Starting(s)
	default:
		return InvalidAction(s, action)
	}
}
