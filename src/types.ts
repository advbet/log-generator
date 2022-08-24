export type ErrorLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

export interface IErrorGenerator {
    data: IData,
    pendingErrors: any[],
    registerProviders(loggingObj: ILogging): void,
    updateData(key: string, value: any): void,
    defaultReport(level: ErrorLevel, message: string, response: any): void,
    report(level: ErrorLevel, message: string | Event | Error, extraData: any): void
}

export interface ILoggly {
    key?: string,
    loggingLevel: ErrorLevel,
    tag?: string[]
}

export interface ISelf {
    displayName?: string,
    userID?: number,
    websiteID?: number,
    ipAddress?: string,
    settings?: ISelfSettings
}

interface ISelfSettings {
    dateFormat?: string,
    notifications?: boolean,
    oddsFormat?: string,
    subscriptions?: boolean,
    timeFormat?: string,
    tz?: any
}

interface IData {
    _LTracker: any[],
    loggly: ILoggly,
    self: ISelf,
    errorLevelOrder: ErrorLevel[],
    version: string | null,
    commit: string | null,
    timeOffset: number,
    startTime: number,
}

interface ILogging {
    loggly: ILoggly,
    logrocketID: string
}