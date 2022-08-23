export type ErrorLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

export interface IErrorGenerator {
    data: IData,
    pendingErrors: any[],
    registerProviders(loggingObj: ILogging): void,
    updateData(key: string, value: any): void,
    defaultReport(level: ErrorLevel, message: string, response: any): void,
    report(level: ErrorLevel, message: string | Event | Error, extraData: any): void
}

export interface ILogging {
    loggly: ILoggly,
    logrocketID: string
}

export interface ILoggly {
    key?: string,
    loggingLevel: ErrorLevel,
    tag?: Array<string>
}

interface IData {
    _LTracker: any[],
    loggly: ILoggly,
    self: any,
    errorLevelOrder: ErrorLevel[],
    version: string | null,
    commit: string | null,
    timeOffset: number | null,
    startTime: number,
}