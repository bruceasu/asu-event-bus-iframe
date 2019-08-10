# asu-event-bus-iframe 

This is a cross domain based on modern browsers processing, between main window
and iframes on `postMessage`.

The main window may `start the EventAgent` to proxy the messages from iframes,
and the iframes using EventBus to listen or publish the message to another.

# interface
## EventAgent
### listen the event for MainWindow
``` javascript
const eventAgent = new EventAgent();
const evetName = "say-hello"
const callback = (eventName, payloa, source) => {
    // your code.
}
eventAgent.on(eventName, callback);

```

### remove the listener

``` javascript
const eventAgent = new EventAgent();
const eventName = "say-hello";
eventAgent.off(eventName);
```

### publish message to iframes.

``` javascript
const eventAgent = new EventAgent();
const eventName = "say-hi";
const payload = "I'm Bill.";
eventAgent.publish(eventName, payload);
```

### publish to mail window itself.

``` javascript
const eventAgent = new EventAgent();
const eventName = "say-hello";
const payload = "I'm Bill.";
eventAgent.publishLocal(eventName, payload);
```

## EventBus

### listen the event

``` javascript
const eventBus = new EventBus();
const eventName = "say-hi";
const callback = (payload) => {
    console.log(payload);
};

// attach a callback to an event
eventBus.on(eventName, callback);

// attach a callback to an event,
// But execute callback once.
eventBus.once(eventName, callback);

// attach a callback to an event.
// This callback will be executed will not be executed
const num = 10;
eventBus.exactly(10, eventName, callback);

```

### remove the listen.

``` javascript
const eventBus = new EventBus();
const eventName = "say-hi";
eventBus.off(eventName);

eventBus.detach(eventName, callback);
eventBUs.detachAll();
```

### publish the event

``` javascript
const eventBus = new EventBus();
const eventName = "say-hi";
eventBus.publish(eventName, "I'm Peter");

```







