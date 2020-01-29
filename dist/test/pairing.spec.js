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
const mock_server_1 = require("./helpers/mock-server");
require("mocha");
describe('apple tv pairing', function () {
    it('should pair with apple tv', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            let server = new mock_server_1.MockServer();
            let device = server.device;
            yield device.openConnection();
            // let callback = await device.pair();
        });
    });
});
