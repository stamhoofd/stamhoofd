package service

import (
	"sync"
	"time"
)

type dependencies struct {
	*service
	stopChannel chan int
	waitGroup   *sync.WaitGroup
	isWaiting   bool
}

func Dependencies(state State) *dependencies {
	return &dependencies{
		service:     state.Service(),
		stopChannel: make(chan int, 1),
		waitGroup:   &sync.WaitGroup{},
		isWaiting:   false,
	}
}

func (s *dependencies) Wait() {
	if s.isWaiting {
		return
	}

	s.isWaiting = true
	// Check whether the dependencies are ready to receive requests.
	dependencies := s.Dependencies()
	s.waitGroup.Add(len(dependencies))

	success := true

	for _, dependency := range dependencies {
		go func(dependency *service) {
			if !dependency.IsReady() {
				s.logger.Infof("Waiting for %s to be ready...", dependency.Name)
			}
			for !dependency.IsReady() {
				select {
				case <-s.stopChannel:
					s.logger.Info("Stop waiting for dependencies...")
					success = false
				default:
				}

				if success == false {
					break
				}
				time.Sleep(time.Millisecond * 500)
			}
			s.logger.Debug("s.waitGroup.Done()")
			s.waitGroup.Done()

		}(dependency)
	}

	go func() {
		s.waitGroup.Wait()
		s.isWaiting = false
		s.logger.Debug("waiting for dependencies done")
	}()
}

func (s *dependencies) Consume(action interface{}) State {
	switch action.(type) {
	case Nothing:
		if s.isWaiting {
			return s
		}
		s.logger.Debug("Done waiting for dependencies.")
		return Running(s)
	case Stop:
		s.stopChannel <- 1
		s.logger.Debug("Stop requested from waiting dependencies.")
		return Stopping(s, nil, s.waitGroup)
	case End:
		s.stopChannel <- 1
		s.logger.Debug("End requested from waiting dependencies.")
		return Ending(s, nil, s.waitGroup)
	default:
		return InvalidAction(s, action)
	}
}
