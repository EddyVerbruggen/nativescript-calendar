export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type CalendarType = "Local" | "CalDAV" | "Exchange" | "Subscription" | "Birthday" | "Mail";

interface Recurrence {
  frequency: RecurrenceFrequency;
  /**
   * Default 1 (every <RecurrenceFrequency>).
   */
  interval: number;
  endDate?: Date;
  count?: number;
}

/**
 * The options object passed into the createEvent function.
 */
export interface CreateEventOptions {
  /**
   * The title of the event.
   */
  title: string;

  /**
   * A valid JS Date representing the start date (and time of the event).
   * If you want an 'All day event', make sure you set the dates to midnight like this:
   *
   *    var d = new Date();
   *    d.setHours(0);
   *    d.setMinutes(0);
   *    d.setSeconds(0);
   *
   *    // then this will create an 'all day event' for tomorrow
   *    startDate = new Date(d.getTime() + (24*60*60*1000));
   *    endDate = new Date(d.getTime() + (2*24*60*60*1000));
   */
  startDate: Date;

  /**
   * A valid JS Date representing the end date (and time of the event).
   */
  endDate: Date;

  /**
   * Where the event takes place.
   */
  location?: string;

  /**
   * Any remarks you want to store with the event.
   */
  notes?: string;

  /**
   * On iOS there's a seperate field for storing a URL with the event.
   * On Android there's not, so we add it to any notes you pass in automatically.
   */
  url?: URL;

  /**
   * Want to use a custom calendar for your app? Pass in the 'name'.
   * If the name doesn't yet exist the plugin will create it for you.
   */
  calendar: {
    name: string;
    /**
     * Example, red: "#FF0000"
     */
    color?: string;
    /**
     * Can be used on Android to group the calendars.
     * Examples: Your app name, or an emailaddress.
     */
    accountName?: string;
  };

  /**
   * Override the default reminders if you like.
   * If you don't the plugin will set a reminder of 60 minutes before the event automatically.
   */
  reminders?: {
    /**
     * Set to null if you don't want a reminder at all.
     * Default 60 (minutes).
     */
    first?: number;
    /**
     * Default null (no second reminder).
     */
    second?: number;
  };

  /**
   * Use this if you want this event to repeat with a certain interval.
   * For instance, if you want an event to recur every other day for 10 days, use:
   * {
   *   frequency: "daily" | "weekly" | "monthly" | "yearly",
   *   interval: 2,
   *   endDate: new Date(new Date().getTime() + (10*24*60*60*1000))
   * }
   */
  recurrence?: Recurrence;
}

interface FindOrDeleteEventsOptions {
  /**
   * When searching, dates are mandatory - the event must be within this interval.
   */
  startDate: Date;

  /**
   * When searching, dates are mandatory - the event must be within this interval.
   */
  endDate: Date;

  /**
   * If you know the Event ID, set it here.
   */
  id?: string;

  /**
   * (Part of) the title of the event.
   */
  title?: string;

  /**
   * (Part of) the location of the event.
   */
  location?: string;

  /**
   * (Part of) the notes of the event.
   * iOS only.
   */
  notes?: string;
}

export interface FindEventsOptions extends FindOrDeleteEventsOptions {
}

export interface DeleteEventsOptions extends FindOrDeleteEventsOptions {
}

export interface DeleteCalendarOptions {
  name: string;
}

export interface Calendar {
  id: string;
  name: string;
  /**
   * iOS: same as 'name'
   * Android: usually the same as 'name' as well
   */
  displayName?: string;
  /**
   * iOS only
   */
  type?: CalendarType;
}

export interface Event {
  id: string;
  title: string;
  location: string;
  notes: string;
  url?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  calendar: Calendar;
  recurrence?: Recurrence;
  reminders?: Array<Reminder>;
  /**
   * iOS only.
   */
  attendees?: Array<Attendee>;
}

export interface Attendee {
  name: string;
  url?: string;
  /**
   * One of: "Unknown", "Pending", "Accepted", "Declined", "Tentative", "Delegated", "Completed", "In Process"
   */
  status: string;
  /**
   * One of: "Unknown", "Required", "Optional", "Chair", "Non Participant"
   */
  role: string;
  /**
   * One of: "Unknown", "Person", "Room", "Resource", "Group"
   */
  type: string;
}

export interface Reminder {
  minutes: number;
}

/**
 * Returns the ID of the event that was created.
 */
export function createEvent(options: CreateEventOptions): Promise<string>;

/**
 * Find events matched on ALL params passed in.
 */
export function findEvents(options: FindEventsOptions): Promise<Event[]>;

/**
 * Usage is the same as findEvents, but the result is a bit different ;)
 * Returns an array of deleted event ID's.
 */
export function deleteEvents(options: DeleteEventsOptions): Promise<string[]>;

/**
 * List all available Calendars on the user's device.
 */
export function listCalendars(): Promise<Calendar[]>;

/**
 * Returns the ID of the deleted calendar (or null if none was deleted).
 */
export function deleteCalendar(options: DeleteCalendarOptions): Promise<string>;

/**
 * No real reason to use this as it's all handled automatically for you.
 */
export function hasPermission(): Promise<boolean>;

/**
 * No real reason to use this as it's all handled automatically for you.
 */
export function requestPermission(): Promise<any>;