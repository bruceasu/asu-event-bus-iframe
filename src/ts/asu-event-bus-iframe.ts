export const ASU_EVENT_BUS_IFRAME_VER=1.0.1;

export const isBrowserSupport = (): void => {
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
 * 回调对象
 */
interface CallbackObject {
  callback: Function,
  number: any,
  execution: number,
}

/**
 * 事件代理，转发事件
 */
export class EventAgent {
  listeners = {};
  localListeners = {};
  constructor() {
    isBrowserSupport();

    // 监听 message 事件
    if (window.addEventListener) {
      window.addEventListener("message", this.dispatch, false);
    } else if (window['attachEvent']) {
      window['attachEvent']("onmessage", this.dispatch);
    }
  }

  addListener (event) {
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
    this.listeners[en].push({
      eventName: en,
      origin: event.origin,
      source: event.source,
    });
  };

  removeListener(event) {
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

  forward (event) {
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


  publishLocal (eventName:string, data:any, source:Window = window) {
    const listeners = this.localListeners[eventName]|| []
    listeners.forEach((callback:Function, index:number) => {
      callback.call(null, data, source);
    });
  };

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
  dispatch = (event) => {
    console.log("EventAgent dispatch event:", event);
    let type = event.data.type || "";
    if (type === MESSAGE_TYPE.TYPE_SUBSCRIBE) {
      // 注册事件
      this.addListener({
        eventName: event.data.eventName,
        origin: event.origin,
        lastEventId: event.lastEventId,
        source: event.source,
        ports: event.ports,
      });
    } else if (type ===  MESSAGE_TYPE.TYPE_UNSUBSCRIBE) {
      this.removeListener({
        eventName: event.data.eventName,
        origin: event.origin,
        lastEventId: event.lastEventId,
        source: event.source,
        ports: event.ports,
      });
    } else if (type ===  MESSAGE_TYPE.TYPE_PUBLISH) {
      // 广播事件
      this.forward({
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
      this.publishLocal (event.data.eventName, event.data.payload, event.source);

    } else if (event.data.eventName) {
      // 自己处理的事件
      this.publishLocal (event.data.eventName, event.data.payload, event.source);
    }
  };

  on(eventName:string, callback:Function) {
    this.localListeners[eventName] = this.localListeners[eventName] || [];
    this.localListeners[eventName].push(callback);
  };

  off(eventName:string)  {
    delete this.localListeners[eventName];
  };

  publish (eventName:string, data:any) {
    window.postMessage({type: "publish", eventName: eventName, payload: data}, "*");
  };

}

/**
 * 客户端
 * @returns {{on: ((eventName:any, callback:any)=>undefined), once: ((eventName:any, callback:any)=>undefined), exactly: ((number:any, eventName:any, callback:any)=>undefined), off: ((eventName:any)=>undefined), detach: ((eventName:any, callback:any)=>undefined), detachAll: (()=>undefined), publish: ((eventName:string, args:any)=>undefined)}}
 * @constructor
 */
export class EventBus {
  listeners = {};
  postMessage =
  window.parent
    ? window.parent.postMessage.bind(window.parent)
    : window.top
    ? window.top.postMessage.bind(window.top)
    : window.postMessage.bind(window);

  constructor() {
    isBrowserSupport();
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
  }

  // 注册监听的消息类型
  registerListener(event, callback, number) {
    let type = event.constructor.name;
    number = this.validateNumber(number || 'any');

    if (type !== 'Array') {
      event = [event];
    }

    event.forEach((e) => {
      if (e.constructor.name !== 'String') {
        throw new Error('Only `String` and array of `String` are accepted for the event names!');
      }
      if (!this.listeners) this.listeners = {};
      this.listeners[e] = this.listeners[e] || [];
      this.listeners[e].push({
        callback: callback,
        number: number
      });
      this.postMessage({type: "subscribe", eventName: e, }, "*")
    });
  };

  // valiodate this.the number is a vild number for the number of executions
  validateNumber  (n) {
    var type = n.constructor.name;

    if (type === 'Number') {
      return n;
    } else if (type === 'String' && n.toLowerCase() === 'any') {
      return 'any';
    }

    throw new Error('Only `Number` and `any` are accepted in the number of possible executions!');
  };

  // return wether or not this event needs to be removed
  toBeRemoved (info: CallbackObject) {
    let number = info.number;
    info.execution = info.execution || 0;
    info.execution++;

    if (number === 'any' || info.execution < number) {
      return false;
    }

    return true;
  };

  dispatch (event: MessageEvent) {
    console.log("EventBus received : ", event);
    let eventName = event.data.eventName || "";
    // console.log("eventName : ", eventName);
    // console.log("this.listeners[eventName] : ", this.listeners[eventName]);
    this.listeners[eventName] && this.listeners[eventName].forEach((info:CallbackObject, index:number) => {
      let callback = info.callback;
      let number = info.number;

      // this event cannot be fired again, remove from the stack
      if (this.toBeRemoved(info)) {
        this.listeners[eventName].splice(index, 1);
        if (this.listeners[eventName].length === 0) {
					this.postMessage({type: "unsubscribe", eventName: eventName, }, "*");
				}
      }
      callback(event.data.payload);
    });
  };

    /**
     * Attach a callback to an event
     * @param {string} eventName - name of the event.
     * @param {function} callback - callback executed when this event is triggered
     */
    on (eventName, callback) {
      this.registerListener(eventName, callback, 'any');
    }

    /**
     * Attach a callback to an event. This callback will not be executed more than once
     * if the event is trigger mutiple times
     * @param {string} eventName - name of the event.
     * @param {function} callback - callback executed when this event is triggered
     */
    once (eventName, callback) {
      this.registerListener(eventName, callback, 1);
    }

    /**
     * Attach a callback to an event. This callback will be executed will not be executed
     * more than the number if the event is trigger mutiple times
     * @param {number} number - max number of executions
     * @param {string} eventName - name of the event.
     * @param {function} callback - callback executed when this event is triggered
     */
    exactly(number, eventName, callback) {
      this.registerListener(eventName, callback, number);
    }

    /**
     * Kill an event with all it's callbacks
     * @param {string} eventName - name of the event.
     */
    off(eventName) {
      delete this.listeners[eventName];
    }

    /**
     * Remove the callback for the given event
     * @param {string} eventName - name of the event.
     * @param {callback} callback - the callback to remove (undefined to remove all of them).
     */
    detach(eventName, callback) {
      for (let k in this.listeners[eventName]) {
        if (
          this.listeners[eventName].hasOwnProperty(k) &&
          (callback == null || callback === undefined || this.listeners[eventName][k].callback === callback )
        ) {
          this.listeners[eventName].splice(k, 1);
        }
      }
    }

    /**
     * Remove all the events
     */
    detachAll() {
      for (let eventName in this.listeners) {
        if (this.listeners.hasOwnProperty(eventName)) {
          this.detach(eventName, undefined);
        }
      }
    }

    /**
     * publish the event
     * @param {string} eventName - name of the event.
     */
    publish (eventName:string, args:any) {
      this.postMessage({type: MESSAGE_TYPE.TYPE_PUBLISH, eventName: eventName, payload: args})
    },

  /**
   * send a message to top window.
   * @param eventName
   * @param args
   */
  sendToAgent(eventName:string, args:any)
    {
      this.postMessage({type: MESSAGE_TYPE.TYPE_SENDTOAGENT, eventName: eventName, payload: args})
    }
}
