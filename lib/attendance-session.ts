export const getStartOfLocalDay = (value: Date | string | number) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

export const getEndOfLocalDay = (value: Date | string | number) => {
    const date = getStartOfLocalDay(value);
    date.setHours(23, 59, 59, 999);
    return date;
};

export const buildTimeOnDay = (
    day: Date | string | number,
    hours: number,
    minutes: number,
    seconds = 0,
    milliseconds = 0
) => {
    const date = getStartOfLocalDay(day);
    date.setHours(hours, minutes, seconds, milliseconds);
    return date;
};

export const isSameLocalDay = (left: Date | string | number, right: Date | string | number) => {
    return getStartOfLocalDay(left).getTime() === getStartOfLocalDay(right).getTime();
};

export const getSameDayClockOut = (
    clockInValue: Date | string | number,
    proposedClockOutValue: Date | string | number = new Date()
) => {
    const clockIn = new Date(clockInValue);
    const proposedClockOut = new Date(proposedClockOutValue);
    const endOfDay = getEndOfLocalDay(clockIn);

    if (proposedClockOut.getTime() < clockIn.getTime()) {
        return clockIn;
    }

    if (proposedClockOut.getTime() > endOfDay.getTime()) {
        return endOfDay;
    }

    return proposedClockOut;
};

export const remapTimestampToDay = (sourceValue: Date | string | number, targetDay: Date | string | number) => {
    const source = new Date(sourceValue);
    return buildTimeOnDay(
        targetDay,
        source.getHours(),
        source.getMinutes(),
        source.getSeconds(),
        source.getMilliseconds()
    );
};
