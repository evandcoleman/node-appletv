"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Message {
    constructor(type, message) {
        this.type = type;
        this.object = message;
    }
    toObject() {
        return this.object;
    }
}
exports.Message = Message;
