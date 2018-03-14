"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SupportedCommand {
    constructor(command, enabled, canScrub) {
        this.command = command;
        this.enabled = enabled;
        this.canScrub = canScrub;
    }
}
exports.SupportedCommand = SupportedCommand;
(function (SupportedCommand) {
    let Command;
    (function (Command) {
        Command["Play"] = "Play";
        Command["Pause"] = "Pause";
        Command["TogglePlayPause"] = "TogglePlayPause";
        Command["EnableLanguageOption"] = "EnableLanguageOption";
        Command["DisableLanguageOption"] = "DisableLanguageOption";
        Command["Stop"] = "Stop";
        Command["SkipForward"] = "SkipForward";
        Command["SkipBackward"] = "SkipBackward";
        Command["BeginFastForward"] = "BeginFastForward";
        Command["BeginRewind"] = "BeginRewind";
        Command["ChangePlaybackRate"] = "ChangePlaybackRate";
        Command["SeekToPlaybackPosition"] = "SeekToPlaybackPosition";
        Command["NextInContext"] = "NextInContext";
        Command["PreviousInContext"] = "PreviousInContext";
    })(Command = SupportedCommand.Command || (SupportedCommand.Command = {}));
})(SupportedCommand = exports.SupportedCommand || (exports.SupportedCommand = {}));
