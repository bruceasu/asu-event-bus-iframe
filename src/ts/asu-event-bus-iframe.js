export const isBrowserSupport = ()=> {
  // https://caniuse.com/#search=postMessage
  if(!window.postMessage) {
    console.log("Your browser is not support.");
    throw {message: "Your browser is not support."}
  }
};

export const MESSAGE_TYPE = {
  TYPE_SUBSCRIBE: "subscribe",
  TYPE_UNSUBSCRIBE: "unsubscribe",
  TYPE_PUBLISH: "publish",
  TYPE_SENDTOAGENT: "send-to-agent",
};

/**
 * 事件代理，转发事件
 */
export const EventAgent = function() {
  isBrowserSupport();

  this.listeners = {};
  this.addListener = (event) => {
    /*
     event = {
       eventName: event.data.eventName,
       origin: event.origin,
       lastEventId: event.lastEventId,
       source: event.source,
       ports: event.ports,
     }
     */
    const en = event.eventName;
    this.listeners[en] = this.listeners[en] || [];
    this.listeners[en].push(event);
  };

  this.removeListener = (event) => {
    const en = event.eventName;
    let array = this.listeners[en];
    if (!array) {
      return;
    }
    for (let i = array.length-1; i >= 0; i--) {
      let e = array[i];
      if (e.origin === event.origin && e.source === event.source) {
        array.splice(i, 1);
      }
    }
    if (array.length === 0) {
      delete this.listeners[en];
    }
  };

  this.forward = (event) => {
    const en  = event.eventName;
    let array = this.listeners[en];
    if (!array) {
      return;
    }
    array.forEach(item => {
			const data = { eventName: event.eventName, payload: event.payload };
			item.source.postMessage(data, item.origin);
    });
  };

  this.localListeners = {};
  this.publishLocal = (eventName, data, source) => {
    const listeners = this.localListeners[eventName]|| []
    listeners.forEach((callback, index) => {
      callback.call(null, data, source);
    });
  }

  let that = this;
  /*
     // https://www.w3.org/TR/webmessaging/

     event.data
     Returns the data of the message.

     event.origin
     Returns the origin of the message, for server-sent events
     and cross-document messaging.

     event.lastEventId
     Returns the last event ID string, for server-sent events.

     event.source
     Returns the WindowProxy of the source window, for cross-document messaging,
     and the MessagePort being attached, in the connect event fired at
     SharedWorkerGlobalScope objects.

     event.ports
     Returns the MessagePort array sent with the message, for
     cross-document messaging and channel messaging.
   */
  function dispatch(event) {
    let type = event.data.type || "";
    if (type === MESSAGE_TYPE.TYPE_SUBSCRIBE) {
      that.addListner({
        eventName: event.data.eventName,
        origin: event.origin,
        lastEventId: event.lastEventId,
        source: event.source,
        ports: event.ports,
      });
    } else if (type === MESSAGE_TYPE.TYPE_UNSUBSCRIBE) {
      that.removeListener({
        eventName: event.data.eventName,
        origin: event.origin,
        lastEventId: event.lastEventId,
        source: event.source,
        ports: event.ports,
      });
    } else if (type === MESSAGE_TYPE.TYPE_PUBLISH){
      that.forward({
        eventName: event.data.eventName,
        payload: event.data.payload,
        from: {
          origin: event.origin,
          lastEventId: event.lastEventId,
          source: event.source,
          ports: event.ports,
        }
      });
    } else if (type ===  MESSAGE_TYPE.TYPE_SENDTOAGENT){
      // 发给自己的事件
      that.publishLocal (event.data.eventName, event.data.payload, event.source);

    } else if (event.data.eventName) {
      // 自己处理的事件
      that.publishLocal (event.data.eventName, event.data.payload, event.source);
    }
  }

  // 监听 message 事件
  if (window.addEventListener) {
    window.addEventListener("message", function (e) {
      dispatch(e);
    }, false);
  } else if (window['attachEvent']) {
    window['attachEvent']("onmessage", function (e) {
      dispatch(e);
    });
  }

  return {
    on: function(eventName, callback) {
      this.localListeners[eventName] = this.localListeners[eventName] || [];
      this.localListeners[eventName].push(callback);
    },
    off: function(eventName) {
      delete this.localListeners[eventName];
    },

    publish: function(eventName, data) {
      window.postMessage({type:  MESSAGE_TYPE.TYPE_PUBLISH, eventName: eventName, payload: data}, "*");
    },

    publishLocal: function(eventName, data) {
      that.publishLocal(eventName, data, window);
    }
  }
};

export const EventBus = function () {
  isBrowserSupport();

  this.listeners = {};
  this.postMessage =
    window.parent
    ? window.parent.postMessage.bind(window.parent)
    : window.top
    ? window.top.postMessage.bind(window.top)
    : window.postMessage.bind(window);

  this.registerListener = (event, callback, number) => {
    let type = event.constructor.name;
    number = this.validateNumber(number || 'any');

    if (type !== 'Array') {
      event = [event];
    }

    event.forEach((e) => {
      if (e.constructor.name !== 'String') {
        throw new Error('Only `String` and array of `String` are accepted for the event names!');
      }

      this.listeners[e] = this.listeners[e] || [];
      this.listeners[e].push({
        callback: callback,
        number: number
      });
      this.postMessage({type: MESSAGE_TYPE.TYPE_SUBSCRIBE, eventName: e, }, "*")
    });
  };

  // valiodate that the number is a vild number for the number of executions
  this.validateNumber = (n) => {
    var type = n.constructor.name;

    if (type === 'Number') {
      return n;
    } else if (type === 'String' && n.toLowerCase() === 'any') {
      return 'any';
    }

    throw new Error('Only `Number` and `any` are accepted in the number of possible executions!');
  };

  // return wether or not this event needs to be removed
  this.toBeRemoved = (info) => {
    let number = info.number;
    info.execution = info.execution || 0;
    info.execution++;

    if (number === 'any' || info.execution < number) {
      return false;
    }

    return true;
  };

  this.dispatch = (event) => {
  	// console.log("receive message from parent", event)
    let eventName = event.data.eventName || "";
    this.listeners[eventName] && this.listeners[eventName].forEach((info, index) => {
      let callback = info.callback;
      // this event cannot be fired again, remove from the stack
      if (this.toBeRemoved(info)) {
        this.listeners[eventName].splice(index, 1);
        if (this.listeners[eventName].length === 0) {
					this.postMessage({type: "unsubscribe", eventName: eventName, }, "*");
				}
      }
      callback.call(null, event.data.payload);
    });
  };

  // 监听 message 事件
  if (window.addEventListener) {
    window.addEventListener("message", (e) => {
      this.dispatch(e);
    }, false);
  } else if (window['attachEvent']) {
    window['attachEvent']("onmessage",  (e) => {
      this.dispatch(e);
    });
  }

  let that = this;
  return {
    /**
     * Attach a callback to an event
     * @param {string} eventName - name of the event.
     * @param {function} callback - callback executed when this event is triggered
     */
    on: function (eventName, callback) {
      that.registerListener.bind(that)(eventName, callback, 'any');
    },

    /**
     * Attach a callback to an event. This callback will not be executed more than once
     * if the event is trigger mutiple times
     * @param {string} eventName - name of the event.
     * @param {function} callback - callback executed when this event is triggered
     */
    once: function (eventName, callback) {
      that.registerListener.bind(that)(eventName, callback, 1);
    },

    /**
     * Attach a callback to an event. This callback will be executed will not be executed
     * more than the number if the event is trigger mutiple times
     * @param {number} number - max number of executions
     * @param {string} eventName - name of the event.
     * @param {function} callback - callback executed when this event is triggered
     */
    exactly: function (number, eventName, callback) {
      that.registerListener.bind(that)(eventName, callback, number);
    },

    /**
     * Kill an event with all it's callbacks
     * @param {string} eventName - name of the event.
     */
    off: function (eventName) {
      delete that.listeners[eventName];
    },

    /**
     * Remove the callback for the given event
     * @param {string} eventName - name of the event.
     * @param {callback} callback - the callback to remove (undefined to remove all of them).
     */
    detach: function (eventName, callback) {
      for (var k in that.listeners[eventName]) {
        if (
          that.listeners[eventName].hasOwnProperty(k) &&
          (that.listeners[eventName][k].callback === callback || callback === undefined)
        ) {
          that.listeners[eventName].splice(k, 1);
        }
      }
    },

    /**
     * Remove all the events
     */
    detachAll: function () {
      for (var eventName in that.listeners) {
        if (that.listeners.hasOwnProperty(eventName)) {
          this.detach(eventName);
        }
      }
    },

    /**
     * publish the event
     * @param {string} eventName - name of the event.
     */
    publish: function (eventName, args) {
      that.postMessage({type: MESSAGE_TYPE.TYPE_PUBLISH, eventName: eventName, payload: args}, "*")
    },

   /**
    * send a message to top window.
    * @param eventName
    * @param args
    */
    sendToAgent(eventName, args)
    {
      that.postMessage({type: MESSAGE_TYPE.TYPE_SENDTOAGENT, eventName: eventName, payload: args}, "*")
    },
    
    /**
     * publish the event
     * @param {string} eventName - name of the event.
     */
    publishToAgent: function (eventName, args) {
      that.postMessage({type: "", eventName: eventName, payload: args}, "*")
    }
  };
};
