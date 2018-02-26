import { Color } from "tns-core-modules/color";
import { Calendar, RecurrenceFrequency } from "./calendar-common";
import { Calendar as ICalendar, Event, Recurrence } from "nativescript-calendar";

const calendarTypes = ["Local", "CalDAV", "Exchange", "Subscription", "Birthday", "Mail"];
const frequencies: Array<RecurrenceFrequency> = ["daily", "weekly", "monthly", "yearly"];

Calendar._eventStore = null;

Calendar._getRecurrenceFrequency = (frequency: RecurrenceFrequency): EKRecurrenceFrequency => {
  if (frequency === "daily") {
    return EKRecurrenceFrequency.Daily;
  } else if (frequency === "weekly") {
    return EKRecurrenceFrequency.Weekly;
  } else if (frequency === "monthly") {
    return EKRecurrenceFrequency.Monthly;
  } else if (frequency === "yearly") {
    return EKRecurrenceFrequency.Yearly;
  } else {
    return null;
  }
};

Calendar._invokeFunctionOnEventStore = function (onInitComplete, reject) {
  if (Calendar._eventStore !== null) {
    onInitComplete();
    return;
  }

  const eventStoreCandidate = EKEventStore.new();
  eventStoreCandidate.requestAccessToEntityTypeCompletion(EKEntityType.Event, function (granted, error) {
    if (granted) {
      Calendar._eventStore = eventStoreCandidate;
      onInitComplete();
    } else {
      // should come here as this method should not be used before checking 'hasPermission'
      reject("Please allow access to the Calendar and try again.");
    }
  });
};

Calendar._hasPermission = function () {
  return EKAuthorizationStatus.Authorized === EKEventStore.authorizationStatusForEntityType(EKEntityType.Event);
};

Calendar.hasPermission = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      resolve(Calendar._hasPermission());
    } catch (ex) {
      console.log("Error in Calendar.hasPermission: " + ex);
      reject(ex);
    }
  });
};

Calendar.requestPermission = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      Calendar._invokeFunctionOnEventStore(resolve, reject);
    } catch (ex) {
      console.log("Error in Calendar.requestPermission: " + ex);
      reject(ex);
    }
  });
};

Calendar._findCalendars = (filterByName: string): Array<EKCalendar> => {
  const calendars = Calendar._eventStore.calendarsForEntityType(EKEntityType.Event);
  const result = [];
  for (let i = 0, j = calendars.count; i < j; i++) {
    const calendar = calendars.objectAtIndex(i);
    if (!filterByName || filterByName === calendar.title) {
      result.push(calendar);
    }
  }
  return result;
};

Calendar._findEKEvents = function (arg, calendars) {
  const datedEvents = Calendar._eventStore.eventsMatchingPredicate(
      Calendar._eventStore.predicateForEventsWithStartDateEndDateCalendars(arg.startDate, arg.endDate, calendars));

  if (datedEvents === null) {
    return null;
  }

  const predicates = [];
  if (arg.title !== undefined) {
    predicates.push("title contains[c] '" + arg.title.replace(/'/g, "\\'") + "'");
  }
  if (arg.location !== undefined) {
    predicates.push("location contains[c] '" + arg.location.replace(/'/g, "\\'") + "'");
  }
  if (arg.notes !== undefined) {
    predicates.push("notes contains[c] '" + arg.notes.replace(/'/g, "\\'") + "'");
  }

  if (predicates.length > 0) {
    const predicate = predicates.join(' AND ');
    return datedEvents.filteredArrayUsingPredicate(NSPredicate.predicateWithFormatArgumentArray(predicate, null));
  } else {
    return datedEvents;
  }
};

Calendar._findEKSource = function () {
  // if iCloud is on, it hides the local calendars, so check for iCloud first
  let eKSource,
      eKSources = Calendar._eventStore.sources;
  for (let i = 0, j = eKSources.count; i < j; i++) {
    eKSource = eKSources.objectAtIndex(i);
    if (eKSource.sourceType === EKSourceType.CalDAV && eKSource.title === "iCloud") {
      return eKSource;
    }
  }

  // ok, not found.. so it's a local calendar
  for (let k = 0, l = eKSources.count; k < l; k++) {
    eKSource = eKSources.objectAtIndex(k);
    if (eKSource.sourceType === EKSourceType.Local) {
      return eKSource;
    }
  }
  return null;
};

Calendar.listCalendars = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      const onPermissionGranted = function () {
        const result = [];
        const ekCalendars: Array<EKCalendar> = Calendar._findCalendars();
        for (let c in ekCalendars) {
          const ekCalendar = ekCalendars[c];
          result.push(<ICalendar>{
            id: ekCalendar.calendarIdentifier,
            name: ekCalendar.title,
            displayName: ekCalendar.title,
            type: calendarTypes[ekCalendar.type]
          });
        }
        resolve(result);
      };

      Calendar._invokeFunctionOnEventStore(onPermissionGranted, reject);
    } catch (ex) {
      console.log("Error in Calendar.listCalendars: " + ex);
      reject(ex);
    }
  });
};

Calendar._ekEventToJSEvent = (ekEvent: EKEvent) => {
  const attendeeTypes = ["Unknown", "Person", "Room", "Resource", "Group"];
  const attendeeRoles = ["Unknown", "Required", "Optional", "Chair", "Non Participant"];
  const attendeeStatuses = ["Unknown", "Pending", "Accepted", "Declined", "Tentative", "Delegated", "Completed", "In Process"];

  const ekCalendar = ekEvent.calendar;

  const attendees = [];
  if (ekEvent.attendees !== null) {
    for (let k = 0, l = ekEvent.attendees.count; k < l; k++) {
      const ekParticipant: EKParticipant = ekEvent.attendees.objectAtIndex(k);
      attendees.push({
        name: ekParticipant.name,
        url: ekParticipant.URL,
        status: attendeeStatuses[ekParticipant.participantStatus],
        role: attendeeRoles[ekParticipant.participantRole],
        type: attendeeTypes[ekParticipant.participantType]
      });
    }
  }

  const reminders = [];
  if (ekEvent.alarms !== null) {
    for (let k = 0, l = ekEvent.alarms.count; k < l; k++) {
      const ekAlarm: EKAlarm = ekEvent.alarms.objectAtIndex(k);
      reminders.push({
        minutes: -(ekAlarm.relativeOffset / 60) // it's in seconds but we specify in minutes, so let's convert
      });
    }
  }

  let recurrence: Recurrence;
  if (ekEvent.recurrenceRules !== null) {
    // just grab the first rule as we return only one anyway
    const ekRecurrenceRule: EKRecurrenceRule = ekEvent.recurrenceRules.objectAtIndex(0);

    recurrence = {
      frequency: frequencies[ekRecurrenceRule.frequency],
      interval: ekRecurrenceRule.interval,
      endDate: ekRecurrenceRule.recurrenceEnd ? ekRecurrenceRule.recurrenceEnd.endDate : null,
      count: ekRecurrenceRule.recurrenceEnd ? ekRecurrenceRule.recurrenceEnd.occurrenceCount : undefined
    };
  }

  return <Event>{
    id: ekEvent.calendarItemIdentifier,
    title: ekEvent.title,
    startDate: ekEvent.startDate,
    endDate: ekEvent.endDate,
    location: ekEvent.location,
    notes: ekEvent.notes,
    url: ekEvent.URL ? ekEvent.URL.absoluteString : null,
    allDay: ekEvent.allDay,
    attendees: attendees,
    reminders: reminders,
    recurrence: recurrence,
    calendar: <ICalendar>{
      id: ekCalendar.calendarIdentifier,
      name: ekCalendar.title,
      displayName: ekCalendar.title,
      type: calendarTypes[ekCalendar.type]
    }
  };
};

Calendar.findEvents = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      const settings = Calendar.merge(arg, Calendar.defaults);
      if (!settings.startDate || !settings.endDate) {
        reject("startDate and endDate are mandatory");
        return;
      }

      const onPermissionGranted = function () {
        let calendars;
        if (settings.calendar.name === null) {
          calendars = Calendar._eventStore.calendarsForEntityType(EKEntityType.Event);
          if (calendars.count === 0) {
            reject("No default calendar found. Is access to the Calendar blocked for this app?");
            return;
          }
        } else {
          const cals: Array<EKCalendar> = Calendar._findCalendars(settings.calendar.name);
          let calendar;
          if (cals.length > 0) {
            calendar = cals[0];
          }
          if (calendar === null) {
            reject("Could not find calendar");
            return;
          } else {
            calendars = [calendar];
          }
        }

        // first try to match by id
        if (settings.id !== null) {
          const eKCalendarItem = Calendar._eventStore.calendarItemWithIdentifier(settings.id);
          if (eKCalendarItem !== null) {
            resolve([Calendar._ekEventToJSEvent(eKCalendarItem)]);
            return;
          }
        }

        // if that's not set or resolved, try other properties
        const events = [];
        const matchingEvents = Calendar._findEKEvents(settings, calendars);
        if (matchingEvents !== null) {
          for (let i = 0, j = matchingEvents.count; i < j; i++) {
            events.push(Calendar._ekEventToJSEvent(matchingEvents.objectAtIndex(i)));
          }
        }
        resolve(events);
      };

      Calendar._invokeFunctionOnEventStore(onPermissionGranted, reject);
    } catch (ex) {
      console.log("Error in Calendar.findEvent: " + ex);
      reject(ex);
    }
  });
};

Calendar.createEvent = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      const settings = Calendar.merge(arg, Calendar.defaults);
      if (!settings.startDate || !settings.endDate) {
        reject("startDate and endDate are mandatory");
        return;
      }
      if (!arg || !arg.reminders) {
        settings.reminders = null;
      }

      const onPermissionGranted = function () {
        const eKEvent = EKEvent.eventWithEventStore(Calendar._eventStore);

        eKEvent.title = settings.title;
        eKEvent.location = settings.location;
        eKEvent.notes = settings.notes;
        eKEvent.startDate = settings.startDate;
        eKEvent.endDate = settings.endDate;

        if (settings.url) {
          eKEvent.URL = NSURL.URLWithString(settings.url);
        }

        const duration = settings.endDate.getTime() - settings.startDate.getTime();
        const moduloDay = duration % (1000 * 60 * 60 * 24);
        if (moduloDay === 0) {
          eKEvent.allDay = true;
        }

        let calendar = null;
        if (settings.calendar.name === null) {
          calendar = Calendar._eventStore.defaultCalendarForNewEvents;
          if (calendar === null) {
            reject("No default calendar found. Is access to the Calendar blocked for this app?");
            return;
          }
        } else {
          const cals: Array<EKCalendar> = Calendar._findCalendars(settings.calendar.name);
          if (cals.length > 0) {
            calendar = cals[0];
          }
          if (calendar === null) {
            // create it
            calendar = EKCalendar.calendarForEntityTypeEventStore(EKEntityType.Event, Calendar._eventStore);
            calendar.title = settings.calendar.name;
            if (settings.calendar.color && Color.isValid(settings.calendar.color)) {
              calendar.CGColor = new Color(settings.calendar.color).ios;
            }
            calendar.source = Calendar._findEKSource();
            Calendar._eventStore.saveCalendarCommitError(calendar, true, null);
          }
        }
        eKEvent.calendar = calendar;

        if (settings.reminders && settings.reminders.first !== null) {
          eKEvent.addAlarm(EKAlarm.alarmWithRelativeOffset(-1 * settings.reminders.first * 60));
        }
        if (settings.reminders && settings.reminders.second !== null) {
          eKEvent.addAlarm(EKAlarm.alarmWithRelativeOffset(-1 * settings.reminders.second * 60));
        }

        if (settings.recurrence.frequency !== null) {
          const frequency = Calendar._getRecurrenceFrequency(settings.recurrence.frequency);
          const eKRecurrenceRule = EKRecurrenceRule.alloc().initRecurrenceWithFrequencyIntervalEnd(frequency, settings.recurrence.interval, null);
          if (arg.recurrence.endDate !== null) {
            eKRecurrenceRule.recurrenceEnd = EKRecurrenceEnd.recurrenceEndWithEndDate(arg.recurrence.endDate);
          }
          eKEvent.addRecurrenceRule(eKRecurrenceRule);
        }

        let error = null;
        Calendar._eventStore.saveEventSpanError(eKEvent, "EKSpanThisEvent", error);
        if (error === null) {
          resolve(eKEvent.calendarItemIdentifier);
        } else {
          reject(error);
        }
      };

      Calendar._invokeFunctionOnEventStore(onPermissionGranted, reject);
    } catch (ex) {
      console.log("Error in Calendar.createEvent: " + ex);
      reject(ex);
    }
  });
};

Calendar.deleteEvents = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      const settings = Calendar.merge(arg, Calendar.defaults);
      if (!settings.startDate || !settings.endDate) {
        reject("startDate and endDate are mandatory");
        return;
      }

      const onPermissionGranted = function () {
        let calendars;
        console.log(">>> deleteEvents settings.calendar.name: " + settings.calendar.name);
        if (settings.calendar.name === null) {
          calendars = Calendar._eventStore.calendarsForEntityType(EKEntityType.Event);
          console.log(">>> deleteEvents calendars " + calendars.count);
          if (calendars.count === 0) {
            reject("No default calendar found. Is access to the Calendar blocked for this app?");
            return;
          }
        } else {
          const cals = Calendar._findCalendars(settings.calendar.name);
          console.log(">>> deleteEvents cals " + cals.length);
          let calendar;
          if (cals.length > 0) {
            calendar = cals[0];
          }
          if (calendar === null) {
            reject("Could not find calendar");
            return;
          } else {
            calendars = [calendar];
          }
        }

        console.log(">>> deleteEvents calendars2 " + JSON.stringify(calendars));
        console.log(">>> deleteEvents settings.id " + settings.id);

        if (settings.id !== null) {
          const eKCalendarItem = Calendar._eventStore.calendarItemWithIdentifier(settings.id);
          if (eKCalendarItem !== null) {
            Calendar._eventStore.removeEventSpanError(eKCalendarItem, EKSpan.ThisEvent, null);
            resolve([settings.id]);
          } else {
            resolve([]);
          }
          return;
        }

        // if that's not set or resolved, try other properties
        const matchingEvents = Calendar._findEKEvents(settings, calendars);
        console.log(">>> deleteEvents matchingEvents " + matchingEvents);
        const deletedEventIds = [];
        if (matchingEvents !== null) {
          for (let i = 0, j = matchingEvents.count; i < j; i++) {
            const ekEvent = matchingEvents.objectAtIndex(i);
            console.log(">>> deleteEvents ekEvent " + ekEvent);
            deletedEventIds.push(ekEvent.calendarItemIdentifier);
            // NOTE: you can delete this event AND future events by passing span:EKSpanFutureEvents
            Calendar._eventStore.removeEventSpanError(ekEvent, EKSpan.ThisEvent, null);
          }
        }
        resolve(deletedEventIds);
      };

      Calendar._invokeFunctionOnEventStore(onPermissionGranted, reject);
    } catch (ex) {
      console.log("Error in Calendar.deleteEvent: " + ex);
      reject(ex);
    }
  });
};

Calendar.deleteCalendar = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      if (!arg.name) {
        reject("name is mandatory");
        return;
      }

      const onPermissionGranted = function () {
        const calendars = Calendar._findCalendars(arg.name);
        let deletedCalId = null;

        if (calendars.length > 0) {
          // syntactically this is a loop but there's most likely only 1 item
          for (let c in calendars) {
            const calendar = calendars[c];
            Calendar._eventStore.removeCalendarCommitError(calendar, true, null);
            deletedCalId = calendar.calendarIdentifier;
          }
        }
        resolve(deletedCalId);
      };

      Calendar._invokeFunctionOnEventStore(onPermissionGranted, reject);
    } catch (ex) {
      console.log("Error in Calendar.deleteCalendar: " + ex);
      reject(ex);
    }
  });
};

module.exports = Calendar;
