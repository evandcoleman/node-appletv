export declare class SupportedCommand {
    command: keyof typeof SupportedCommand.Command;
    enabled: boolean;
    canScrub: boolean;
    constructor(command: keyof typeof SupportedCommand.Command, enabled: boolean, canScrub: boolean);
}
export declare module SupportedCommand {
    enum Command {
        Play = "Play",
        Pause = "Pause",
        TogglePlayPause = "TogglePlayPause",
        EnableLanguageOption = "EnableLanguageOption",
        DisableLanguageOption = "DisableLanguageOption",
        Stop = "Stop",
        SkipForward = "SkipForward",
        SkipBackward = "SkipBackward",
        BeginFastForward = "BeginFastForward",
        BeginRewind = "BeginRewind",
        ChangePlaybackRate = "ChangePlaybackRate",
        SeekToPlaybackPosition = "SeekToPlaybackPosition",
        NextInContext = "NextInContext",
        PreviousInContext = "PreviousInContext",
    }
}
