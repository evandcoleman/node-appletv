"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PairState;
(function (PairState) {
    PairState[PairState["Setup"] = 2] = "Setup";
    PairState[PairState["Verify"] = 3] = "Verify";
})(PairState = exports.PairState || (exports.PairState = {}));
var PairSetupState;
(function (PairSetupState) {
    PairSetupState[PairSetupState["M1"] = 1] = "M1";
    PairSetupState[PairSetupState["M2"] = 2] = "M2";
    PairSetupState[PairSetupState["M3"] = 3] = "M3";
    PairSetupState[PairSetupState["M4"] = 4] = "M4";
    PairSetupState[PairSetupState["M5"] = 5] = "M5";
    PairSetupState[PairSetupState["M6"] = 6] = "M6";
})(PairSetupState = exports.PairSetupState || (exports.PairSetupState = {}));
var PairVerifyState;
(function (PairVerifyState) {
    PairVerifyState[PairVerifyState["M1"] = 1] = "M1";
    PairVerifyState[PairVerifyState["M2"] = 2] = "M2";
    PairVerifyState[PairVerifyState["M3"] = 3] = "M3";
    PairVerifyState[PairVerifyState["M4"] = 4] = "M4";
})(PairVerifyState = exports.PairVerifyState || (exports.PairVerifyState = {}));
