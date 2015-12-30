var application = require("application");
var Calendar = require("./calendar-common");

Calendar._fields = {
    EVENT_ID: android.provider.CalendarContract.Instances.EVENT_ID,
    CALENDAR: {
        ID: "calendar_id",
        NAME: "calendar_displayName"
    },
    TITLE: "title",
    MESSAGE: "description",
    LOCATION: "eventLocation",
    STARTDATE: "dtstart",
    ENDDATE: "dtend",
    ALLDAY: "allDay",
    TIMEZONE: "eventTimezone",
    HAS_ALARM: "hasAlarm",
    RRULE: "rrule"
};

(function () {
    setTimeout(function() {
        if (!Calendar._hasPermission()) {
            Calendar._requestPermission();
        }
    }, 1000);
})();

Calendar._hasPermission = function() {
    var hasPermission = android.os.Build.VERSION.SDK_INT < 23; // Android M. (6.0)
    var activity = application.android.foregroundActivity;
    if (activity === undefined) {
        return;
    }
    if (!hasPermission) {
        // no need to distinguish between read and write atm
        var hasReadPermission = android.content.pm.PackageManager.PERMISSION_GRANTED ==
            android.support.v4.content.ContextCompat.checkSelfPermission(activity, android.Manifest.permission.READ_CALENDAR);

        var hasWritePermission = android.content.pm.PackageManager.PERMISSION_GRANTED ==
            android.support.v4.content.ContextCompat.checkSelfPermission(activity, android.Manifest.permission.WRITE_CALENDAR);

        hasPermission = hasReadPermission && hasWritePermission;
    }
    return hasPermission;
};

Calendar.hasPermission = function(arg) {
  return new Promise(function (resolve, reject) {
    try {
      resolve(Calendar._hasPermission());
    } catch (ex) {
      console.log("Error in Calendar.hasPermission: " + ex);
      reject(ex);
    }
  });
};

Calendar._requestPermission = function() {
    android.support.v4.app.ActivityCompat.requestPermissions(
        application.android.foregroundActivity,
        [android.Manifest.permission.READ_CALENDAR, android.Manifest.permission.WRITE_CALENDAR],
        556);
};

Calendar.requestPermission = function(arg) {
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
  var projection = [
      "_id",
      "name"
  ];
  
  var sortOrder = null;
  var selections = null;
  var selection = "visible=1";

  var contentResolver = application.android.foregroundActivity.getContentResolver();
  var uriBuilder = android.provider.CalendarContract.Calendars.CONTENT_URI.buildUpon();
  var uri = uriBuilder.build();
  var cursor = contentResolver.query(
      uri,
      projection,
      selection,
      selections,
      sortOrder);

  var calendars = [];
  if (cursor.moveToFirst()) {
    do {
      var name = cursor.getString(1);
      if (!filterByName || name == filterByName) {  
        var calendar = {
            id: cursor.getLong(0),
            name: name
        };
        calendars.push(calendar);
      }
    } while (cursor.moveToNext());
  }
  return calendars;
};

Calendar._findEvents = function(arg) {
  var settings = Calendar.merge(arg, Calendar.defaults);

  var projection = [
      Calendar._fields.EVENT_ID,      
      Calendar._fields.CALENDAR.ID,
      Calendar._fields.CALENDAR.NAME,
      Calendar._fields.TITLE,
      Calendar._fields.MESSAGE,
      Calendar._fields.LOCATION,
      Calendar._fields.STARTDATE,
      Calendar._fields.ENDDATE,
      Calendar._fields.ALLDAY
  ];
  
  var sortOrder = android.provider.CalendarContract.Instances.BEGIN + " ASC, " + android.provider.CalendarContract.Instances.END + " ASC";
  var selection = "";
  var selections = [];

  if (settings.title != null) {
    selection += Calendar._fields.TITLE + " LIKE ?";
    selections.push("%" + settings.title + "%");
  }
  if (settings.location != null) {
    if (!"".equals(selection)) {
      selection += " AND ";
    }
    selection += Calendar._fields.LOCATION + " LIKE ?";
    selections.push("%" + settings.location + "%");
  }

  var uriBuilder = android.provider.CalendarContract.Instances.CONTENT_URI.buildUpon();
  android.content.ContentUris.appendId(uriBuilder, settings.startDate.getTime());
  android.content.ContentUris.appendId(uriBuilder, settings.endDate.getTime());
  var contentResolver = application.android.foregroundActivity.getContentResolver();
  var uri = uriBuilder.build();
  var cursor = contentResolver.query(
      uri,
      projection,
      selection,
      selections,
      sortOrder);

  var events = [];
  if (cursor.moveToFirst()) {
    do {
      var event = {
          id: cursor.getLong(cursor.getColumnIndex(Calendar._fields.EVENT_ID)),
          title: cursor.getString(cursor.getColumnIndex(Calendar._fields.TITLE)),
          notes: cursor.getString(cursor.getColumnIndex(Calendar._fields.MESSAGE)),
          location: cursor.getString(cursor.getColumnIndex(Calendar._fields.LOCATION)),
          startDate: new Date(cursor.getLong(cursor.getColumnIndex(Calendar._fields.STARTDATE))),
          endDate: new Date(cursor.getLong(cursor.getColumnIndex(Calendar._fields.ENDDATE))),
          allDay: cursor.getInt(cursor.getColumnIndex(Calendar._fields.ALLDAY)) == 1,
          calendar: {
              id: cursor.getLong(cursor.getColumnIndex(Calendar._fields.CALENDAR.ID)),
              name: cursor.getString(cursor.getColumnIndex(Calendar._fields.CALENDAR.NAME))
          }
      };
      events.push(event);
    } while (cursor.moveToNext());
  }
  return events;
};

Calendar.listCalendars = function(arg) {
  return new Promise(function (resolve, reject) {
    try {
      resolve(Calendar._findCalendars());
    } catch (ex) {
      console.log("Error in Calendar.listCalendars: " + ex);
      reject(ex);
    }
  });
};

Calendar.findEvents = function(arg) {
  return new Promise(function (resolve, reject) {
    try {
      if (!arg.startDate || !arg.endDate) {
          reject("startDate and endDate are mandatory");
          return;
      }
      resolve(Calendar._findEvents(arg));
    } catch (ex) {
      console.log("Error in Calendar.findEvents: " + ex);
      reject(ex);
    }
  });
};

Calendar.deleteEvents = function(arg) {
  return new Promise(function (resolve, reject) {
    try {
      if (!arg.startDate || !arg.endDate) {
          reject("startDate and endDate are mandatory");
          return;
      }
      var events = Calendar._findEvents(arg);
      var ContentResolver = application.android.foregroundActivity.getContentResolver();
      var deletedEventIds = [];
      for (var e in events) {
          var event = events[e];
          var uri = android.provider.CalendarContract.Events.CONTENT_URI;
          var eventUri = android.content.ContentUris.withAppendedId(uri, event.id);
          ContentResolver.delete(eventUri, null, null);
          deletedEventIds.push(event.id);
      }
      resolve(deletedEventIds);
    } catch (ex) {
      console.log("Error in Calendar.deleteEvents: " + ex);
      reject(ex);
    }
  });
};

Calendar.createEvent = function(arg) {
  return new Promise(function (resolve, reject) {
    try {
      var settings = Calendar.merge(arg, Calendar.defaults);
      if (!settings.startDate || !settings.endDate) {
          reject("startDate and endDate are mandatory");
          return;
      }

      var ContentValues = new android.content.ContentValues();
      var Events = android.provider.CalendarContract.Events;
      ContentValues.put(Calendar._fields.TIMEZONE, java.util.TimeZone.getDefault().getID());
      ContentValues.put(Calendar._fields.STARTDATE, new java.lang.Long(settings.startDate.getTime()));
      ContentValues.put(Calendar._fields.ENDDATE, new java.lang.Long(settings.endDate.getTime()));
      
      ContentValues.put(Calendar._fields.TITLE, settings.title);
      ContentValues.put(Calendar._fields.LOCATION, settings.location);

      // there's no separate url field, so adding it to the notes
      var description = settings.notes;
      if (settings.url != null) {
        if (settings.notes == null) {
          description = settings.url;
        } else {
          description += " " + settings.url;
        }
      }
      ContentValues.put(Calendar._fields.MESSAGE, description);
      var ContentResolver = application.android.foregroundActivity.getContentResolver();
      ContentValues.put(Calendar._fields.HAS_ALARM, new java.lang.Integer(settings.reminders.first || settings.reminders.second ? 1 : 0));
      var calendarId = null;
      if (settings.calendar.name != null) {
          var calendars = Calendar._findCalendars(settings.calendar.name);
          if (calendars.length > 0) {
              calendarId = calendars[0].id;
          } else {
              // create it
              var calUri = android.provider.CalendarContract.Calendars.CONTENT_URI;
              var calendarContentValues = new android.content.ContentValues();
              calendarContentValues.put("name", settings.calendar.name);
              calendarContentValues.put("calendar_displayName", settings.calendar.name);
              calendarContentValues.put("visible", new java.lang.Integer(1));
              calendarContentValues.put("account_type", "LOCAL");
              calendarContentValues.put("name", settings.calendar.name);
              calendarContentValues.put("account_name", settings.calendar.name);
              calendarContentValues.put("ownerAccount", settings.calendar.name);
            //   calendarContentValues.put("calendar_color", android.graphics.Color.RED);
              calendarContentValues.put("sync_events", new java.lang.Integer(1));
              calUri = calUri.buildUpon()
                .appendQueryParameter("caller_is_syncadapter", "true")
                .appendQueryParameter("account_name", settings.calendar.name)
                .appendQueryParameter("account_type", "LOCAL")
                .build();
              ContentResolver.insert(calUri, calendarContentValues);
              // retrieve the calendar we just created
              var cals = Calendar._findCalendars(settings.calendar.name);
              if (cals.length > 0) {
                  calendarId = cals[0].id;
              }
          }
      }
      if (calendarId == null) {
          calendarId = settings.calendar.id;
      }
      ContentValues.put(Calendar._fields.CALENDAR.ID, new java.lang.Integer(calendarId));

      // recurrence
      if (settings.recurrence.frequency != null) {
          if (settings.recurrence.endDate == null) {
              ContentValues.put(Calendar._fields.RRULE, "FREQ=" + settings.recurrence.frequency.toUpperCase() + ";INTERVAL=" + settings.recurrence.interval);
          } else {
              var endDate = arg.recurrence.endDate;
              var yyyy = endDate.getFullYear().toString();
              var mm = (endDate.getMonth()+1).toString();
              var dd  = endDate.getDate().toString();
              var yyyymmdd = yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]);
              ContentValues.put(Calendar._fields.RRULE, "FREQ=" + settings.recurrence.frequency.toUpperCase() + ";INTERVAL=" + settings.recurrence.interval + ";UNTIL=" + yyyymmdd);
          }
      }
      
      var eventsUri = android.net.Uri.parse("content://com.android.calendar/events");
      var uri = ContentResolver.insert(eventsUri, ContentValues);
      var createdEventID = uri.getLastPathSegment();
      console.log("---- created event with id: " + createdEventID);

      // now add reminders, if any
      if (settings.reminders.first) {
          var firstReminderContentValues = new android.content.ContentValues();
          firstReminderContentValues.put("event_id", createdEventID);
          firstReminderContentValues.put("minutes", new java.lang.Long(settings.reminders.first));
          firstReminderContentValues.put("method", new java.lang.Integer(1));
          ContentResolver.insert(android.net.Uri.parse("content://com.android.calendar/reminders"), firstReminderContentValues);
      }
      if (settings.reminders.second) {
          var secondReminderContentValues = new android.content.ContentValues();
          secondReminderContentValues.put("event_id", createdEventID);
          secondReminderContentValues.put("minutes", new java.lang.Long(settings.reminders.second));
          secondReminderContentValues.put("method", new java.lang.Integer(1));
          ContentResolver.insert(android.net.Uri.parse("content://com.android.calendar/reminders"), secondReminderContentValues);
      }

      resolve(createdEventID);
    } catch (ex) {
      console.log("Error in Calendar.createEvent: " + ex);
      reject(ex);
    }
  });
};

module.exports = Calendar;