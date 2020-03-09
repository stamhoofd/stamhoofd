package service

import (
	"math"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

type Callback func()
type message struct {
	Key      string
	Callback Callback
}

type debouncer struct {
	messages chan message
	interval time.Duration
	timer    *time.Timer
	queue    *sync.Map

	logger *logrus.Entry
}

func Debouncer(logger *logrus.Entry, interval time.Duration) *debouncer {
	d := &debouncer{
		messages: make(chan message),
		// Do not start the timer here. There is no other more convenient way:
		// https://github.com/golang/go/issues/12721
		// https://go-review.googlesource.com/c/go/+/14871/1/src/time/sleep.go
		timer: time.NewTimer(math.MaxInt64),
		queue: new(sync.Map),
		logger: logger.WithField(
			"prefix",
			"DEBOUNCER",
		),
		interval: interval,
	}
	d.start()
	return d
}

func (d *debouncer) start() {
	go func() {
		for {
			select {
			// Wait for new callback requests.
			case message := <-d.messages:
				d.logger.Debugf("Received callback %v", message.Key)
				d.queue.Store(message.Key, message.Callback)
				d.timer.Reset(d.interval)
			// When the timer runs out, call all of the callbacks.
			case <-d.timer.C:
				d.queue.Range(func(key, value interface{}) bool {
					d.logger.Debugf("Calling callback %v", key)
					callback := value.(Callback)
					callback()
					return true
				})
				// Empty the queue
				d.queue = new(sync.Map)
			}
		}
	}()
}

func (d *debouncer) Debounce(key string, callback Callback) {
	d.messages <- message{
		Key:      key,
		Callback: callback,
	}
}
