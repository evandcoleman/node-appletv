import * as bplist from 'bplist-parser';

export class Notification {
  public name: Notification.Name;
  public userInfo: {};

  constructor(message: {}) {
    let name = message['notification'];
    if (name == '_kMRNowPlayingPlaybackQueueChangedNotification') {
      this.name = Notification.Name.PlaybackQueueChanged;
    }

    if (message['userInfo'] && message['userInfo'].length > 0) {
      this.userInfo = bplist.parseBuffer(message['userInfo'][0]);
    }
  }
}

export module Notification {
  export enum Name {
    PlaybackQueueChanged = 'PlaybackQueueChanged'
  }
}