/// <reference types="node" />
import { EventEmitter } from 'events';
export default class TypedEventEmitter<T> extends EventEmitter {
    constructor(...args: any[]);
    _on(event: string, callback: (...args: any[]) => void): this;
    on(event: string & keyof T, callback: (arg: T[typeof event]) => void): this;
    emit(event: string & keyof T, payload?: T[typeof event]): boolean;
}
