export class NowPlayingInfo {
  public duration: number;
  public elapsedTime: number;
  public title: string;
  public artist: string;
  public album: string;
  public appDisplayName: string;
  public appBundleIdentifier: string;
  public playbackState: NowPlayingInfo.State;
  public timestamp: number;

  constructor(public message: any) {
    let nowPlayingInfo = message.nowPlayingInfo;
    if (nowPlayingInfo) {
      this.duration = nowPlayingInfo.duration;
      this.elapsedTime = nowPlayingInfo.elapsedTime;
      this.title = nowPlayingInfo.title;
      this.artist = nowPlayingInfo.artist;
      this.album = nowPlayingInfo.album;
      this.timestamp = nowPlayingInfo.timestamp;
    }
    this.appDisplayName = message.displayName;
    this.appBundleIdentifier = message.displayID;
    if (message.playbackState == 2) {
      this.playbackState = NowPlayingInfo.State.Paused;
    } else if (message.playbackState == 1) {
      this.playbackState = NowPlayingInfo.State.Playing;
    }
  }

  public percentCompleted(): number {
    if (!this.elapsedTime || !this.duration) { return 0; }

    return Math.floor((this.elapsedTime / this.duration) * 100);
  }

  public toString(): string {
    if (this.artist) {
      return this.title + " by " + this.artist + " (" + this.percentCompleted() + "%) | "
        + this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
        + this.playbackState; 
    } else if (this.title) {
      return this.title + " (" + this.percentCompleted() + "%) | "
        + this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
        + this.playbackState; 
    } else {
      return this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
        + this.playbackState; 
    }
  }
}

export module NowPlayingInfo {
  export enum State {
    Playing = 'playing',
    Paused = 'paused'
  }
}