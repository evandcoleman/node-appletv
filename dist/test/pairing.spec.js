"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const message_1 = require("../lib/message");
const mock_server_1 = require("./helpers/mock-server");
const chai_1 = require("chai");
require("mocha");
describe('apple tv pairing', function () {
    beforeEach(function () {
        this.server = new mock_server_1.MockServer();
        this.device = this.server.device;
    });
    afterEach(function () {
        this.server.close();
    });
    it('should send introduction', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.device.openConnection();
            let message = yield this.server.message;
            chai_1.expect(message.type).to.equal(message_1.Message.Type.DeviceInfoMessage);
        });
    });
});
