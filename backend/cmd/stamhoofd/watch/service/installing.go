package service

import (
	"bufio"
	"bytes"
	"io"
	"os/exec"
	"strings"
)

type installing struct {
	*service
	err error
}

func Installing(state State) *installing {
	return &installing{
		service: state.Service(),
	}
}

func (s *installing) Wait() {
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
		s.err = err
	}
}

func (s *installing) Consume(action interface{}) State {
	if s.err != nil {
		return Stopped(s, s.err)
	}

	switch action.(type) {
	case Nothing:
		if s.HasDependencies() {
			s.logger.Debug("Install done, but has dependencies.")
			return Dependencies(s)
		}
		s.logger.Debug("Install done, running.")
		return Running(s)
	case Restart:
		return s
	default:
		return InvalidAction(s, action)
	}
}
