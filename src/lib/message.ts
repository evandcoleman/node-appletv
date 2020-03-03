import { Message as ProtoMessage} from 'protobufjs';

export class Message {
  public type: Message.Type;
  public identifier: string;
  public payload: any;

  private typeName: string;

  constructor(private message: ProtoMessage<{}>) {
    this.type = message['type'];
    this.identifier = message['identifier'];
    let keys = Object.keys(message.toJSON()).filter(key => { return key[0] == "."; });
    if (keys.length > 0) {
      let key = keys[0].slice(1);
      this.typeName = key.charAt(0).toUpperCase() + key.slice(1);
      this.payload = message[keys[0]];
    }
  }

  toObject(): any {
    return this.message;
  }

  toString(): string {
    return JSON.stringify({
      type: this.typeName,
      identifier: this.identifier,
      payload: this.payload
    }, null, 2);
  }
}

export module Message {
  export enum Type {
    SendCommandMessage = 1,
    CommandResultMessage = 2,
    GetStateMessage = 3,
    SetStateMessage = 4,
    SetArtworkMessage = 5,
    RegisterHidDeviceMessage = 6,
    RegisterHidDeviceResultMessage = 7,
    SendHidEventMessage = 8,
    SendHidReportMessage = 9,
    SendVirtualTouchEventMessage = 10,
    NotificationMessage = 11,
    ContentItemsChangedNotificationMessage = 12,
    DeviceInfoMessage = 15,
    ClientUpdatesConfigMessage = 16,
    VolumeControlAvailabilityMessage = 17,
    GameControllerMessage = 18,
    RegisterGameControllerMessage = 19,
    RegisterGameControllerResponseMessage = 20,
    UnregisterGameControllerMessage = 21,
    RegisterForGameControllerEventsMessage = 22,
    KeyboardMessage = 23,
    GetKeyboardSessionMessage = 24,
    TextInputMessage = 25,
    GetVoiceInputDevicesMessage = 26,
    GetVoiceInputDevicesResponseMessage = 27,
    RegisterVoiceInputDeviceMessage = 28,
    RegisterVoiceInputDeviceResponseMessage = 29,
    SetRecordingStateMessage = 30,
    SendVoiceInputMessage = 31,
    PlaybackQueueRequestMessage = 32,
    TransactionMessage = 33,
    CryptoPairingMessage = 34,
    GameControllerPropertiesMessage = 35,
    SetReadyStateMessage = 36,
    DeviceInfoUpdate = 37,
    SetDisconnectingStateMessage = 38,
    SendButtonEvent = 39,
    SetHiliteModeMessage = 40,
    WakeDeviceMessage = 41,
    GenericMessage = 42,
    SendPackedVirtualTouchEvent = 43,
    SendLyricsEvent = 44,
    PlaybackQueueCapabilitiesRequest = 45,
    ModifyOutputContextRequest = 46
  }
}
