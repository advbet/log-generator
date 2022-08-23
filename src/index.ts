import isObjectLike from 'lodash/isObjectLike';
import dayjs from 'dayjs';
import 'loggly-jslogger';
import UAParser from 'ua-parser-js';

import {
  IErrorGenerator,
  ILogging,
  ErrorLevel,
  ILoggly
} from './types';

export const privateFields = ['pass', 'bank', 'card', 'tele', 'phone', 'mail', 'user', 'token', 'tax', 'address'];

let count = 0;
let retrying = false;

const errGenerator: IErrorGenerator = {
  data: {
    _LTracker: [],
    loggly: {
      loggingLevel: 'TRACE'
    },
    self: {},
    errorLevelOrder: ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'],
    version: null,
    commit: null,
    timeOffset: null,
    startTime: Date.now(),
  },
  pendingErrors: [],
  registerProviders(loggingObj: ILogging) {
    if (
      loggingObj
      && Object.prototype.hasOwnProperty.call(loggingObj, 'loggly')
    ) {
      registerLoggly(loggingObj.loggly);
      errGenerator.updateData('loggly', loggingObj.loggly);
    }
  },
  // Method to update errGenerator data,
  // one method can be used to update any errGenerator data
  // attribute by passing key/value pairs to the following function
  updateData(key: string, value: any) {
    // @ts-ignore
    errGenerator.data[key] = value;
  },
  defaultReport(level: ErrorLevel, message: string, response: any) {
    errGenerator.report(level, message, {
      status: response.status,
      error: response.data,
      config: {
        method: response.config.method,
        url: response.config.url,
        data: isObjectLike(response.config.data)
          ? JSON.stringify(response.config.data)
          : response.config.data,
      },
      requestDuration: response.config.duration,
    });
  },
  // Method to send generated error report to error logging service
  report(level: ErrorLevel, message: string | Event | Error, extraData: any) {
    const loggedData = extraData || {};
    if (typeof message === 'string' && message.length > 0 && message.indexOf('Script error.') > -1) {
      return;
    }

    loggedData.location = window.location.href;
    loggedData.clientData = genClientBlock(window);
    loggedData.userData = userBlock(errGenerator.data.self);
    loggedData.additional = additionalBlock(
      errGenerator.data.version,
      errGenerator.data.commit,
      errGenerator.data.timeOffset,
      errGenerator.data.startTime,
    );

    if (
      errGenerator.data.loggly.key
      && isAllowedErrorLevel(
        level,
        errGenerator.data.loggly.loggingLevel,
        errGenerator.data.errorLevelOrder,
      )
    ) {
      reportToLoggly(
        level,
        JSON.stringify(message, Object.getOwnPropertyNames(message)),
        loggedData,
      );
    }
  },
};

// Check if current error should be reported
function isAllowedErrorLevel(errorLevel: ErrorLevel, loggingLevel: ErrorLevel, possibleLevels: ErrorLevel[]) {
  if (possibleLevels.indexOf(loggingLevel) === -1) {
    return true;
  }
  return (
    possibleLevels.indexOf(loggingLevel) >= possibleLevels.indexOf(errorLevel)
  );
}
// A function to register loggly
function registerLoggly(loggly: ILoggly) {
  // @ts-ignore
  errGenerator.data._LTracker = window._LTracker || [];
  errGenerator.data._LTracker.push({
    logglyKey: loggly.key,
    sendConsoleErrors: true,
    tag: loggly.tag,
  });

  // This is extension of tracker prototype track function. In previous versions
  // of loggly-jslogger this function had possibility to add fallback.
  // This is possible to see in admin where older version is being used.
  // This fallback helps us to guarantee to send error if for some reason
  // first time it didn't reach the service.
  // ****
  // Currently used version:
  // https://cloudfront.loggly.com/js/loggly.tracker-2.2.2.js
  // ****
  // Code was taken from latest version (Content-type):
  // https://cloudfront.loggly.com/js/loggly.tracker-latest.js

  errGenerator.data._LTracker.track = function (this: any, data: any) {
    // @ts-ignore
    data.sessionId = errGenerator.data._LTracker.session_id;
    try {
      // creating an asynchronous XMLHttpRequest
      const xmlHttp = new XMLHttpRequest();
      xmlHttp.open('POST', this.inputUrl, true); // true for asynchronous request
      xmlHttp.setRequestHeader('Content-Type', 'text/plain; charset=utf-8');
      xmlHttp.send(JSON.stringify(data));
      xmlHttp.onreadystatechange = (event) => {
        onStateChange(event, data);
      };
    } catch (ex) {
      if (window && window.console && typeof window.console.log === 'function') {
        console.log(`Failed to log to loggly because of this exception:\n${ex}`);
        console.log("Failed log data:", data);
      }
    }
  };
}

function onStateChange(event: any, data: any) {
  if (!event?.target) {
    return;
  }

  if (event.target.readyState !== 4) {
    return;
  }

  if (
    event.target.readyState === 4
    && event.target.status >= 200
    && event.target.status < 300
  ) {
    retrying = false;
    if (errGenerator.pendingErrors.length > 0) {
      if (count > 0) {
        errGenerator.pendingErrors.push({
          level: 'ERROR',
          message: 'full queue',
          missedErrorsCount: count,
        });
        count = 0;
      }
      errGenerator.data._LTracker.push(
        errGenerator.pendingErrors.splice(0, 1)[0],
      );
      return;
    }
    return;
  }
  if (!retrying) {
    retrying = true;
    setTimeout(() => {
      errGenerator.data._LTracker.push(
        errGenerator.pendingErrors.splice(0, 1)[0],
      );
      retrying = false;
    }, 10000);
  }
  if (errGenerator.pendingErrors.length >= 100) {
    count += 1;
    return;
  }
  // @ts-ignore
  errGenerator.pendingErrors.push(data);
}

function reportToLoggly(level: ErrorLevel, message: string, extraData: any) {
  if (errGenerator.pendingErrors.length > 0) {
    if (errGenerator.pendingErrors.length >= 100) {
      count += 1;
      return;
    }
    // @ts-ignore
    errGenerator.pendingErrors.push({
      level,
      message,
      ...extraData,
    });
    return;
  }
  // @ts-ignore
  errGenerator.data._LTracker.push({
    level,
    message,
    ...extraData,
  });
}

function userBlock(self: any) {
  if (self && self.settings) {
    return {
      User: self.displayName,
      userID: self.userID,
      websiteID: self.websiteID,
      ipAddress: self.ipAddress,
      Settings: {
        dateFormat: self.settings.dateFormat,
        notifications: self.settings.notifications,
        oddsFormat: self.settings.oddsFormat,
        subscriptions: self.settings.subscriptions,
        timeFormat: self.settings.timeFormat,
        tz: self.settings.tz,
      },
    };
  }
  return '[ANONYMOUS]';
}

function additionalBlock(
  version: string | null, 
  commit: string | null, 
  timeOffset: number | null, 
  startTime: number
) {
  // App uptime calculation
  // calculates time passed from initial application load to error time
  const currentTime = new Date().getTime();
  const upTime = currentTime - startTime;
  const d1 = dayjs(currentTime);
  const d2 = dayjs(startTime);
  const dayDiff = d1.diff(d2, 'd');
  const days = Math.floor(dayDiff) > 0
    ? `${Math.floor(dayDiff)}d `
    : '';
  const upTimeDispl = days + dayjs.utc(upTime).format('HH:mm:ss');

  return {
    frontEndVersion: version,
    frontEndCommit: commit,
    clientTime: dayjs().format(),
    // TODO: should be turned on, when time offset calculation is handled on web-ui same as cashier-ui
    // serverTime: dayjs(currentTime + timeOffset).format(),
    // timeOffset: timeOffset / 1000,
    applicationUptime: upTimeDispl,
  };
}

function genClientBlock(window: Window) {
  const userAgent: UAParser.IResult = (new UAParser()).getResult();
  let screenSize = '';

  if (window.screen.width) {
    const width = window.screen.width ? window.screen.width : '';
    const height = window.screen.height ? window.screen.height : '';
    screenSize += `${width} x ${height}`;
  }

  return {
    OS: `${userAgent.os.name} ${userAgent.os.version}`,
    Browser: `${userAgent.browser.name} ${userAgent.browser.version}`,
    Mobile: userAgent.device.type === 'mobile',
    DeviceType: userAgent.device.type || '',
    Device: `${userAgent.device.vendor || ''} ${userAgent.device.model || ''}`,
    Cookies: window.navigator.cookieEnabled,
    screenSize,
    UserAgent: userAgent.ua,
  };
}

export { 
  errGenerator
}
