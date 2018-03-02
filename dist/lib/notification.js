"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bplist = require("bplist-parser");
class Notification {
    constructor(message) {
        let name = message['notification'];
        if (name == '_kMRNowPlayingPlaybackQueueChangedNotification') {
            this.name = Notification.Name.PlaybackQueueChanged;
        }
        if (message['userInfo'] && message['userInfo'].length > 0) {
            this.userInfo = bplist.parseBuffer(message['userInfo'][0]);
        }
    }
}
exports.Notification = Notification;
(function (Notification) {
    let Name;
    (function (Name) {
        Name["PlaybackQueueChanged"] = "PlaybackQueueChanged";
    })(Name = Notification.Name || (Notification.Name = {}));
})(Notification = exports.Notification || (exports.Notification = {}));
