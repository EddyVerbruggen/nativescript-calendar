var Calendar = require("./calendar-common");
var application = require("application");

Calendar._eventStore = null;

(function () {
    setTimeout(function() {
        Calendar._requestPermission();
    }, 500);
})();

Calendar._getRecurrenceFrequency = function (frequency) {
  if (frequency == Calendar.RecurrenceFrequency.DAILY) {
    return EKRecurrenceFrequencyDaily;
  } else if (frequency == Calendar.RecurrenceFrequency.WEEKLY) {
    return EKRecurrenceFrequencyWeekly;
  } else if (frequency == Calendar.RecurrenceFrequency.MONTHLY) {
    return EKRecurrenceFrequencyMonthly;
  } else if (frequency == Calendar.RecurrenceFrequency.YEARLY) {
    return EKRecurrenceFrequencyYearly;
  } else {
    return null;
  }
};

Calendar._hasPermission = function () {
  var authStatus = EKEventStore.authorizationStatusForEntityType(EKEntityTypeEvent);
  return authStatus == EKAuthorizationStatusAuthorized;
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

Calendar._requestPermission = function () {
    var eventStoreCandidate = EKEventStore.alloc().init();
    eventStoreCandidate.requestAccessToEntityTypeCompletion(EKEntityTypeEvent, function (granted, error) {
        if (granted) {
            Calendar._eventStore = eventStoreCandidate;
        }
    });
};

Calendar.requestPermission = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      Calendar._requestPermission();
      resolve();
    } catch (ex) {
      console.log("Error in Calendar.requestPermission: " + ex);
      reject(ex);
    }
  });
};

Calendar._findCalendars = function (filterByName) {
  var calendars = Calendar._eventStore.calendarsForEntityType(EKEntityTypeEvent);
  var result = [];
  for (var i = 0, j = calendars.count; i < j; i++) {
    var calendar = calendars.objectAtIndex(i);
    if (!filterByName || filterByName == calendar.title) {
        result.push(calendar);
    }
  }
  return result;
};

Calendar._findEKEvents = function (arg, calendars) {
  var datedEvents = Calendar._eventStore.eventsMatchingPredicate(
      Calendar._eventStore.predicateForEventsWithStartDateEndDateCalendars(arg.startDate, arg.endDate, calendars));

  if (datedEvents == null) {
    return null;
  }

  var predicates = [];
  if (arg.title != null) {
    predicates.push("title contains[c] '" + arg.title.replace(/'/g, "\\'") + "'");
  }
  if (arg.location != null) {
    predicates.push("location contains[c] '" + arg.location.replace(/'/g, "\\'") + "'");
  }
  if (arg.notes != null) {
    predicates.push("notes contains[c] '" + arg.notes.replace(/'/g, "\\'") + "'");
  }

  if (predicates.length > 0) {
    var predicate = predicates.join(' AND ');
    return datedEvents.filteredArrayUsingPredicate(NSPredicate.predicateWithFormatArgumentArray(predicate, null));
  } else {
    return datedEvents;
  }
};

Calendar._findEKSource = function () {
  // if iCloud is on, it hides the local calendars, so check for iCloud first
  var eKSources = Calendar._eventStore.sources;
  for (var i = 0, j = eKSources.count; i < j; i++) {
    var eKSource = eKSources.objectAtIndex(i);
    if (eKSource.sourceType == EKSourceTypeCalDAV && eKSource.title == "iCloud") {
      return eKSource;
    }
  }

  // ok, not found.. so it's a local calendar
  for (var k = 0, l = eKSources.count; k < l; k++) {
    var eKSource = eKSources.objectAtIndex(k);
    if (eKSource.sourceType == EKSourceTypeLocal) {
      return eKSource;
    }
  }
  return null;
};

Calendar.listCalendars = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      var result = [];
      var ekCalendars = Calendar._findCalendars();
      for (var c in ekCalendars) {
          var ekCalendar = ekCalendars[c];
          result.push({
              id: ekCalendar.calendarIdentifier,
              name: ekCalendar.title
          });
      }
      resolve(result);
    } catch (ex) {
      console.log("Error in Calendar.listCalendars: " + ex);
      reject(ex);
    }
  });
};

Calendar._ekEventToJSEvent = function (ekEvent) {
    var calendarTypes = ["Local", "CalDAV", "Exchange", "Subscription", "Birthday", "Mail"];
    var attendeeTypes = ["Unknown", "Person", "Room", "Resource", "Group"];
    var attendeeRoles = ["Unknown", "Required", "Optional", "Chair", "Non Participant"];
    var attendeeStatuses = ["Unknown", "Pending", "Accepted", "Declined", "Tentative", "Delegated", "Completed", "In Process"];

    var ekCalendar = ekEvent.calendar;
    var attendees = [];
    if (ekEvent.attendees != null) {
        for (var k = 0, l = ekEvent.attendees.count; k < l; k++) {
            var ekParticipant = ekEvent.attendees.objectAtIndex(k);
            attendees.push({
                name: ekParticipant.name,
                url: ekParticipant.URL,
                status: attendeeStatuses[ekParticipant.participantStatus],
                role: attendeeRoles[ekParticipant.participantRole],
                type: attendeeTypes[ekParticipant.participantType]
            });
        }
    }
    return {
        id: ekEvent.calendarItemIdentifier,
        title: ekEvent.title,
        startDate: ekEvent.startDate,
        endDate: ekEvent.endDate,
        location: ekEvent.location,
        notes: ekEvent.message,
        url: ekEvent.URL,
        allDay: ekEvent.allDay,
        attendees: attendees,
        calendar: {
            id: ekCalendar.calendarIdentifier,
            name: ekCalendar.title,
            color: ekCalendar.color,
            type: calendarTypes[ekCalendar.type]
        }
    };
};

Calendar.findEvents = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      var settings = Calendar.merge(arg, Calendar.defaults);
      if (!settings.startDate || !settings.endDate) {
          reject("startDate and endDate are mandatory");
          return;
      }

      var calendars;
      if (settings.calendar.name == null) {
        calendars = Calendar._eventStore.calendarsForEntityType(EKEntityTypeEvent);
        if (calendars.count == 0) {
          reject("No default calendar found. Is access to the Calendar blocked for this app?");
          return;
        }
      } else {
        var cals = Calendar._findCalendars(settings.calendar.name);
        var calendar;
        if (cals.length > 0) {
            calendar = cals[0];
        }
        if (calendar == null) {
          reject("Could not find calendar");
          return;
        } else {
          calendars = [calendar];
        }
      }
      
      // first try to match by id
      if (settings.id != null) {
         var eKCalendarItem = Calendar._eventStore.calendarItemWithIdentifier(settings.id);
         if (eKCalendarItem != null) {
             resolve([Calendar._ekEventToJSEvent(eKCalendarItem)]);
             return;
         }
      }

      // if that's not set or resolved, try other properties
      var events = [];
      var matchingEvents = Calendar._findEKEvents(settings, calendars);
      if (matchingEvents != null) {
          for (var i = 0, j = matchingEvents.count; i < j; i++) {
              events.push(Calendar._ekEventToJSEvent(matchingEvents.objectAtIndex(i)));
          }
      }
      resolve(events);
    } catch (ex) {
      console.log("Error in Calendar.findEvent: " + ex);
      reject(ex);
    }
  });
};

Calendar.createEvent = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      var settings = Calendar.merge(arg, Calendar.defaults);
      if (!settings.startDate || !settings.endDate) {
          reject("startDate and endDate are mandatory");
          return;
      }

      var eKEvent = EKEvent.eventWithEventStore(Calendar._eventStore);

      eKEvent.title = settings.title;
      eKEvent.location = settings.location;
      eKEvent.notes = settings.notes;
      eKEvent.startDate = settings.startDate;
      eKEvent.endDate = settings.endDate;

      if (settings.url != null) {
        eKEvent.URL = NSURL.URLWithString(settings.url);
      }

      var duration = settings.endDate.getTime() - settings.startDate.getTime();
      var moduloDay = duration % (1000 * 60 * 60 * 24);
      if (moduloDay == 0) {
        eKEvent.allDay = true;
      }

      var calendar = null;
      if (settings.calendar.name == null) {
        calendar = Calendar._eventStore.defaultCalendarForNewEvents;
        if (calendar == null) {
          reject("No default calendar found. Is access to the Calendar blocked for this app?");
          return;
        }
      } else {
        var cals = Calendar._findCalendars(settings.calendar.name);
        if (cals.length > 0) {
            calendar = cals[0];
        }
        if (calendar == null) {
          // create it
          calendar = EKCalendar.calendarForEntityTypeEventStore("EKEntityTypeEvent", Calendar._eventStore);
          calendar.title = settings.calendar.name;
          if (false && settings.calendar.color != null) {
            // TODO hex to UIColor
            calendar.CGColor = settings.calendar.color;
          }
          calendar.source = Calendar._findEKSource();
          Calendar._eventStore.saveCalendarCommitError(calendar, true, null);
        }
      }
      eKEvent.calendar = calendar;

      if (settings.reminders.first != null) {
        eKEvent.addAlarm(EKAlarm.alarmWithRelativeOffset(-1 * settings.reminders.first * 60));
      }
      if (settings.reminders.second != null) {
        eKEvent.addAlarm(EKAlarm.alarmWithRelativeOffset(-1 * settings.reminders.second * 60));
      }

      if (settings.recurrence.frequency != null) {
        var frequency = Calendar._getRecurrenceFrequency(settings.recurrence.frequency);
        var eKRecurrenceRule = EKRecurrenceRule.alloc().initRecurrenceWithFrequencyIntervalEnd(frequency, settings.recurrence.interval, null);
        if (arg.recurrence.endDate != null) {
          eKRecurrenceRule.recurrenceEnd = EKRecurrenceEnd.recurrenceEndWithEndDate(arg.recurrence.endDate);
        }
        eKEvent.addRecurrenceRule(eKRecurrenceRule);
      }

      var error = null;
      Calendar._eventStore.saveEventSpanError(eKEvent, "EKSpanThisEvent", error);
      if (error == null) {
        console.log("---- created event with id: " + eKEvent.calendarItemIdentifier);
        resolve(eKEvent.calendarItemIdentifier);
      } else {
        reject(error);
      }

    } catch (ex) {
      console.log("Error in Calendar.createEvent: " + ex);
      reject(ex);
    }
  });
};

Calendar.deleteEvents = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      var settings = Calendar.merge(arg, Calendar.defaults);
      if (!settings.startDate || !settings.endDate) {
          reject("startDate and endDate are mandatory");
          return;
      }

      var calendars;
      if (settings.calendar.name == null) {
        calendars = Calendar._eventStore.calendarsForEntityType(EKEntityTypeEvent);
        if (calendars.count == 0) {
          reject("No default calendar found. Is access to the Calendar blocked for this app?");
          return;
        }
      } else {
        var cals = Calendar._findCalendars(settings.calendar.name);
        var calendar;
        if (cals.length > 0) {
            calendar = cals[0];
        }
        if (calendar == null) {
          reject("Could not find calendar");
          return;
        } else {
          calendars = [calendar];
        }
      }

      // first try to match by id
      if (settings.id != null) {
         var eKCalendarItem = Calendar._eventStore.calendarItemWithIdentifier(settings.id);
         if (eKCalendarItem != null) {
             Calendar._eventStore.removeEventSpanError(eKCalendarItem, EKSpanThisEvent, null);
             resolve([settings.id]);
             return;
         }
      }

      // if that's not set or resolved, try other properties
      var matchingEvents = Calendar._findEKEvents(settings, calendars);
      var deletedEventIds = [];
      if (matchingEvents != null) {
        for (var i = 0, j = matchingEvents.count; i < j; i++) {
          var ekEvent = matchingEvents.objectAtIndex(i);
          deletedEventIds.push(ekEvent.calendarItemIdentifier);
          // NOTE: you can delete this event AND future events by passing span:EKSpanFutureEvents
          Calendar._eventStore.removeEventSpanError(ekEvent, EKSpanThisEvent, null);
        }
      }
      resolve(deletedEventIds);
    } catch (ex) {
      console.log("Error in Calendar.deleteEvent: " + ex);
      reject(ex);
    }
  });
};

module.exports = Calendar;