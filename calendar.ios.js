var Calendar = require("./calendar-common");
var application = require("application");

Calendar._eventStore = null;

(function() {
  // TODO if this works (not on require, but on first invocation of the plugin)
  // then we can init eventStore and permissions here! Easier to use.
  console.log("---- auto-exec function in Calendar");
})();

Calendar._getRecurrenceFrequency = function(frequency) {
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

Calendar._hasPermission = function() {
  var eventStore = EKEventStore.alloc().init();
  // TODO or "EKEntityTypeEvent" (with quotes)
  var authStatus = eventStore.authorizationStatusForEntityType(EKEntityTypeEvent)
  console.log("--- authStatus: " + authStatus);
}

Calendar._hasPermission = function() {
  var eventStore = EKEventStore.alloc().init();
  var authStatus = eventStore.authorizationStatusForEntityType(EKEntityTypeEvent)
  // TODO or EKEntityTypeEvent (without quotes)
  eventStore.requestAccessToEntityTypeCompletion("EKEntityTypeEvent", function(granted, error) {
    console.log("--- granted: " + granted);
    console.log("--- error: " + error);
  });
}

Calendar._findCalendar = function (name) {
  // TODO see remotenotification plugin for how to properly loop these
  for (var eKCalendar in Calendar._eventStore.calendarsForEntityType("EKEntityTypeEvent")) {
    console.log("----- calendar: " + eKCalendar);
    if (eKCalendar.title == name) {
      return eKCalendar;
    }
  }
  return null;
}

Calendar._findEKEvents = function (arg) {
  var predicates = [];
  if (arg.title != null) {
    // TODO escape quotes, see Calendar.m#311
    predicates.push("title contains[c] '" + arg.title + "'");
  }
  if (arg.location != null) {
    // TODO see TODO above
    predicates.push("location contains[c] '" + arg.location + "'");
  }
  if (arg.notes != null) {
    // TODO see TODO above
    predicates.push("notes contains[c] '" + arg.notes + "'");
  }
  var datedEvents = Calendar._eventStore.eventsMatchingPredicate(
      Calendar._eventStore.predicateForEventsWithStartDateEndDateCalendars(startDate, endDate, calendars));

  if (predicates.length > 0) {
    var predicate = predicates.join(' AND ');
    console.log("--- using predicate " + predicate);
    return datedEvents.filteredArrayUsingPredicate(NSPredicate.predicateWithFormat(predicate));
  } else {
    return datedEvents;
  }
}

Calendar._findEKSource = function() {
  // if iCloud is on, it hides the local calendars, so check for iCloud first
  // TODO see remotenotification plugin for how to properly loop these
  for (var eKSource in Calendar._eventStore.sources) {
    console.log("----- eksource: " + eKSource);
    if (eKSource.sourceType == "EKSourceTypeCalDAV" && eKSource.title == "iCloud") {
      return eKSource;
    }
  }

  // ok, not found.. so it's a local calendar
  // TODO see TODO above
  for (var eKSource in Calendar._eventStore.sources) {
    if (eKSource.sourceType == "EKSourceTypeLocal") {
      return eKSource;
    }
  }
  return null;
}

Calendar.findEvents = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      // TODO if we don't auto-init the eventtore, do it here
      var settings = Calendar.merge(arg, Calendar.defaults);
      var calendars;
      if (settings.calendar.name == null) {
        calendars = Calendar._eventStore.calendarsForEntityType("EKEntityTypeEvent");
        if (calendars.count == 0) {
          reject("No default calendar found. Is access to the Calendar blocked for this app?");
          return;
        }
      } else {
        var calendar = Calendar._findEKCalendar(settings.calendar.name);
        if (calendar == null) {
          reject("Could not find calendar");
          return;
        } else {
          calendars = [];
          calendars.push(calendar);
        }
      }
      var eKCalendarItem, matchingEvents;
      if (settings.id != null) {
        eKCalendarItem = Calendar._eventStore.calendarItemWithIdentifier(settings.id);
      }
      if (eKCalendarItem == null) {
        matchingEvents = Calendar._findEKEvents(arg);
      } else {
        matchingEvents = [];
        matchingEvents.push(eKCalendarItem);
      }
      
      resolve(matchingEvents);
    } catch (ex) {
      console.log("Error in Calendar.findEvent: " + ex);
      reject(ex);
    }
  });
};

Calendar.createEvent = function (arg) {
  return new Promise(function (resolve, reject) {
    try {
      
      if (Calendar._eventStore == null) {
        //if (Calendar._hasPermission)
      }

      var settings = Calendar.merge(arg, Calendar.defaults);

      var eKEvent = EKEvent.eventWithEventStore(Calendar._eventStore);

      eKEvent.title = settings.title;
      eKEvent.location = settings.location;
      eKEvent.notes = settings.notes;
      eKEvent.startDate = settings.startDate;
      eKEvent.endDate = settings.endDate; // TODO see #65 of Calendar.m
      
      if (settings.url != null) {
        eKEvent.URL = NSURL.URLWithString(settings.url);
      }

      var duration = settings.endDate.getTime() - settings.startDate.getTime();
      var moduloDay = duration % (60 * 60 * 24);
      if (moduloDay == 0) {
        ekEvent.allDay = true;
      }
      
      var calendar = null;
      if (settings.calendar.name == null) {
        calendar = Calendar._eventStore.defaultCalendarForNewEvents;
        if (calendar == null) {
          reject("No default calendar found. Is access to the Calendar blocked for this app?");
          return;
        }
      } else {
        calendar = Calendar._findCalendar(settings.calendar.name);
        if (calendar == null) {
          // create it
          calendar = EKCalendar.calendarForEntityTypeEventStore("EKEntityTypeEvent", Calendar._eventStore);
          calendar.title = settings.calendar.name;
          // TODO color
          calendar.source = Calendar._findEKSource();
        }
      }
      eKEvent.calendar = calendar;

      if (settings.reminders.first != null) {
        eKEvent.addAlarm(EKAlarm.alarmWithRelativeOffset(-1*settings.reminders.first*60));
      }
      if (settings.reminders.second != null) {
        eKEvent.addAlarm(EKAlarm.alarmWithRelativeOffset(-1*settings.reminders.second*60));
      }
      
      if (settings.recurrence.frequency != null) {
        var frequency = Calendar._getRecurrenceFrequency(settings.recurrence.frequency);
        var eKRecurrenceRule = EKRecurrenceRule.alloc().initRecurrenceWithFrequencyIntervalEnd(frequency, settings.recurrence.interval, null);
        if (settings.recurrence.endDate != null) {
          eKRecurrenceRule.recurrenceEnd = settings.recurrence.endDate;
        }
        eKEvent.addRecurrenceRule(eKRecurrenceRule);
      }
      var error = null;
      // TODO error mutability
      Calendar._eventStore.saveEventSpanError(eKEvent, "EKSpanThisEvent", error);
      if (error == null) {
        resolve(eKEvent.calendarItemIdentifier);
      } else {
        // TODO message (error.userInfo.description)
        reject(error);
      }
      
    } catch (ex) {
      console.log("Error in Calendar.createEvent: " + ex);
      reject(ex);
    }
  });
};

module.exports = Calendar;