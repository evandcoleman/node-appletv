"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Message {
    constructor(type, message) {
        this.type = type;
        this.message = message;
        let key = "." + type.charAt(0).toLowerCase() + type.slice(1);
        this.payload = message[key];
    }
    toObject() {
        return this.message;
    }
}
exports.Message = Message;
