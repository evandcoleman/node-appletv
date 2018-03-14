"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class TypedEventEmitter extends events_1.EventEmitter {
    constructor(...args) {
        super(...args);
    }
    _on(event, callback) {
        return super.on(event, callback);
    }
    on(event, callback) {
        return super.on(event, callback);
    }
    emit(event, payload) {
        return super.emit(event, payload);
    }
}
exports.default = TypedEventEmitter;
