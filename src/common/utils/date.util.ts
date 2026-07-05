export class DateUtil {
  /**
   * Check if two date ranges overlap
   */
  static rangesOverlap(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date,
  ): boolean {
    return startA < endB && startB < endA;
  }

  /**
   * Parse HH:mm to minutes from midnight
   */
  static timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if a time checkTime (e.g. "09:30") is within range (e.g. "08:00" - "22:00")
   */
  static timeIsWithinRange(checkTime: string, startTime: string, endTime: string): boolean {
    const check = this.timeToMinutes(checkTime);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    if (start <= end) {
      return check >= start && check <= end;
    } else {
      // Over midnight case
      return check >= start || check <= end;
    }
  }

  /**
   * Get day of week index (0-6) from date
   */
  static getDayOfWeek(date: Date): number {
    return date.getDay();
  }
}
