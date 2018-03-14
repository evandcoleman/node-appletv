/// <reference types="node" />
import { EventEmitter } from 'events';
export default class TypedEventEmitter<T> extends EventEmitter {
    constructor(...args: any[]);
    _on(event: string, callback: (...args) => void): this;
    on(event: keyof T, callback: (arg: T[typeof event]) => void): this;
    emit(event: keyof T, payload?: T[typeof event]): boolean;
}
