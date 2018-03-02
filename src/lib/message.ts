

export class Message {
  public type: string;
  private object: {};

  constructor(type: string, message: {}) {
    this.type = type;
    this.object = message;
  }

  toObject(): {} {
    return this.object;
  }
}