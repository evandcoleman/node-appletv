"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Message {
    constructor(message) {
        this.message = message;
        this.type = message['type'];
        this.identifier = message['identifier'];
        let keys = Object.keys(message.toJSON()).filter(key => { return key[0] == "."; });
        if (keys.length > 0) {
            this.payload = message[keys[0]];
        }
    }
    toObject() {
        return this.message;
    }
}
exports.Message = Message;
(function (Message) {
    let Type;
    (function (Type) {
        Type[Type["SendCommandMessage"] = 1] = "SendCommandMessage";
        Type[Type["CommandResultMessage"] = 2] = "CommandResultMessage";
        Type[Type["GetStateMessage"] = 3] = "GetStateMessage";
        Type[Type["SetStateMessage"] = 4] = "SetStateMessage";
        Type[Type["SetArtworkMessage"] = 5] = "SetArtworkMessage";
        Type[Type["RegisterHidDeviceMessage"] = 6] = "RegisterHidDeviceMessage";
        Type[Type["RegisterHidDeviceResultMessage"] = 7] = "RegisterHidDeviceResultMessage";
        Type[Type["SendHidEventMessage"] = 8] = "SendHidEventMessage";
        Type[Type["SendHidReportMessage"] = 9] = "SendHidReportMessage";
        Type[Type["SendVirtualTouchEventMessage"] = 10] = "SendVirtualTouchEventMessage";
        Type[Type["NotificationMessage"] = 11] = "NotificationMessage";
        Type[Type["ContentItemsChangedNotificationMessage"] = 12] = "ContentItemsChangedNotificationMessage";
        Type[Type["DeviceInfoMessage"] = 15] = "DeviceInfoMessage";
        Type[Type["ClientUpdatesConfigMessage"] = 16] = "ClientUpdatesConfigMessage";
        Type[Type["VolumeControlAvailabilityMessage"] = 17] = "VolumeControlAvailabilityMessage";
        Type[Type["GameControllerMessage"] = 18] = "GameControllerMessage";
        Type[Type["RegisterGameControllerMessage"] = 19] = "RegisterGameControllerMessage";
        Type[Type["RegisterGameControllerResponseMessage"] = 20] = "RegisterGameControllerResponseMessage";
        Type[Type["UnregisterGameControllerMessage"] = 21] = "UnregisterGameControllerMessage";
        Type[Type["RegisterForGameControllerEventsMessage"] = 22] = "RegisterForGameControllerEventsMessage";
        Type[Type["KeyboardMessage"] = 23] = "KeyboardMessage";
        Type[Type["GetKeyboardSessionMessage"] = 24] = "GetKeyboardSessionMessage";
        Type[Type["TextInputMessage"] = 25] = "TextInputMessage";
        Type[Type["GetVoiceInputDevicesMessage"] = 26] = "GetVoiceInputDevicesMessage";
        Type[Type["GetVoiceInputDevicesResponseMessage"] = 27] = "GetVoiceInputDevicesResponseMessage";
        Type[Type["RegisterVoiceInputDeviceMessage"] = 28] = "RegisterVoiceInputDeviceMessage";
        Type[Type["RegisterVoiceInputDeviceResponseMessage"] = 29] = "RegisterVoiceInputDeviceResponseMessage";
        Type[Type["SetRecordingStateMessage"] = 30] = "SetRecordingStateMessage";
        Type[Type["SendVoiceInputMessage"] = 31] = "SendVoiceInputMessage";
        Type[Type["PlaybackQueueRequestMessage"] = 32] = "PlaybackQueueRequestMessage";
        Type[Type["TransactionMessage"] = 33] = "TransactionMessage";
        Type[Type["CryptoPairingMessage"] = 34] = "CryptoPairingMessage";
        Type[Type["GameControllerPropertiesMessage"] = 35] = "GameControllerPropertiesMessage";
        Type[Type["SetReadyStateMessage"] = 36] = "SetReadyStateMessage";
        Type[Type["DeviceInfoUpdate"] = 37] = "DeviceInfoUpdate";
        Type[Type["SetDisconnectingStateMessage"] = 38] = "SetDisconnectingStateMessage";
        Type[Type["SendButtonEvent"] = 39] = "SendButtonEvent";
        Type[Type["SetHiliteModeMessage"] = 40] = "SetHiliteModeMessage";
        Type[Type["WakeDeviceMessage"] = 41] = "WakeDeviceMessage";
        Type[Type["GenericMessage"] = 42] = "GenericMessage";
        Type[Type["SendPackedVirtualTouchEvent"] = 43] = "SendPackedVirtualTouchEvent";
        Type[Type["SendLyricsEvent"] = 44] = "SendLyricsEvent";
        Type[Type["PlaybackQueueCapabilitiesRequest"] = 45] = "PlaybackQueueCapabilitiesRequest";
        Type[Type["ModifyOutputContextRequest"] = 46] = "ModifyOutputContextRequest";
    })(Type = Message.Type || (Message.Type = {}));
})(Message = exports.Message || (exports.Message = {}));
