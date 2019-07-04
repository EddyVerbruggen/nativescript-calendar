import * as application from "tns-core-modules/application";
import * as utils from "tns-core-modules/utils/utils";
import { Color } from "tns-core-modules/color";
import { AndroidActivityRequestPermissionsEventData } from "tns-core-modules/application";
import { Calendar } from "./calendar-common";
import { Event, Recurrence, RecurrenceFrequency } from "./";

const PERMISSION_REQUEST_CODE = 2222;

declare const android, global: any;

const ActivityCompatPackageName = useAndroidX() ? global.androidx.core.app : android.support.v4.app;
const ContextCompatPackageName = useAndroidX() ? global.androidx.core.content : android.support.v4.content;

function useAndroidX () {
  return global.androidx && global.androidx.appcompat;
}

Calendar._fields = {
  EVENT_ID: android.provider.CalendarContract.Instances.EVENT_ID,
  CALENDAR: {
    ID: "calendar_id",
    NAME: "calendar_displayName",
    TYPE: "calendar_type"
  },
  TITLE: "title",
  MESSAGE: "description",
  LOCATION: "eventLocation",
  STARTDATE: "dtstart",
  ENDDATE: "dtend",
  BEGIN: "begin",
  END: "end",
  ALLDAY: "allDay",
  TIMEZONE: "eventTimezone",
  HAS_ALARM: "hasAlarm",
  RRULE: "rrule"
};

Calendar._remindersFields = {
  ID: android.provider.CalendarContract.Reminders._ID,
  EVENT_ID: android.provider.CalendarContract.Reminders.EVENT_ID,
  MINUTES: "minutes",
  METHOD: "method"
};

(function () {
  application.android.on(application.AndroidApplication.activityRequestPermissionsEvent, (args: AndroidActivityRequestPermissionsEventData) => {
    if (args.requestCode !== PERMISSION_REQUEST_CODE) {
      return;
    }
    for (let i = 0; i < args.permissions.length; i++) {
      if (args.grantResults[i] === android.content.pm.PackageManager.PERMISSION_DENIED) {
        Calendar._reject("Please allow access to the Calendar and try again.");
        return;
      }
    }

    if (Calendar._onPermissionGranted) {
      Calendar._onPermissionGranted();
    } else {
      console.log("No after-permission callback function specified for requestCode " + args.requestCode + ". That's a bug in the nativescript-calendar plugin, please report it!");
    }
  });
})();

Calendar._hasPermission = function (perms) {
  if (android.os.Build.VERSION.SDK_INT < 23) { // Android M. (6.0)
    return true;
  }

  for (const permission of perms) {
    if (android.content.pm.PackageManager.PERMISSION_GRANTED !== ContextCompatPackageName.ContextCompat.checkSelfPermission(utils.ad.getApplicationContext(), permission)) {
      return false;
    }
  }
  return true;
};

Calendar._hasReadPermission = function () {
  return Calendar._hasPermission([android.Manifest.permission.READ_CALENDAR]);
};

Calendar._hasWritePermission = function () {
  return Calendar._hasPermission([android.Manifest.permission.WRITE_CALENDAR]);
};

Calendar._hasReadWritePermission = function () {
  return Calendar._hasPermission([android.Manifest.permission.READ_CALENDAR, android.Manifest.permission.WRITE_CALENDAR]);
};

Calendar._requestPermission = function (permissions, onPermissionGranted, reject) {
  Calendar._onPermissionGranted = onPermissionGranted;
  Calendar._reject = reject;
  ActivityCompatPackageName.ActivityCompat.requestPermissions(
      application.android.foregroundActivity,
      permissions,
      PERMISSION_REQUEST_CODE
  );
};

Calendar._requestReadPermission = function (onPermissionGranted, reject) {
  Calendar._requestPermission([android.Manifest.permission.READ_CALENDAR], onPermissionGranted, reject);
};

Calendar._requestWritePermission = function (onPermissionGranted, reject) {
  Calendar._requestPermission([android.Manifest.permission.WRITE_CALENDAR], onPermissionGranted, reject);
};

Calendar._requestReadWritePermission = function (onPermissionGranted, reject) {
  Calendar._requestPermission([android.Manifest.permission.READ_CALENDAR, android.Manifest.permission.WRITE_CALENDAR], onPermissionGranted, reject);
};

export function hasPermission(arg) {
  return new Promise((resolve, reject) => {
    try {
      resolve(Calendar._hasPermission([android.Manifest.permission.READ_CALENDAR, android.Manifest.permission.WRITE_CALENDAR]));
    } catch (ex) {
      console.log("Error in Calendar.hasPermission: " + ex);
      reject(ex);
    }
  });
}

export function requestPermission() {
  return new Promise((resolve, reject) => {
    try {
      Calendar._requestPermission(
          [android.Manifest.permission.READ_CALENDAR, android.Manifest.permission.WRITE_CALENDAR],
          resolve,
          reject
      );
    } catch (ex) {
      console.log("Error in Calendar.requestPermission: " + ex);
      reject(ex);
    }
  });
}

Calendar._findCalendars = filterByName => {
  const projection = [
    "_id",
    "name",
    "calendar_displayName"
  ];

  let sortOrder = null;
  let selections = null;
  let selection = "visible=1";

  const contentResolver = utils.ad.getApplicationContext().getContentResolver();
  const uriBuilder = android.provider.CalendarContract.Calendars.CONTENT_URI.buildUpon();
  const uri = uriBuilder.build();
  let cursor = contentResolver.query(
      uri,
      projection,
      selection,
      selections,
      sortOrder);

  const calendars = [];
  if (cursor.moveToFirst()) {
    do {
      const name = cursor.getString(1);
      const calendar_display_name = cursor.getString(cursor.getColumnIndex(Calendar._fields.CALENDAR.NAME));
      if (!filterByName || name === filterByName) {
        calendars.push({
          id: cursor.getString(0),
          name: name,
          displayName: calendar_display_name
        });
      }
    } while (cursor.moveToNext());
  }
  return calendars;
};

Calendar._findEvents = function (arg) {
  const settings = Calendar.merge(arg, Calendar.defaults);

  const projection = [
    Calendar._fields.EVENT_ID,
    Calendar._fields.CALENDAR.ID,
    Calendar._fields.CALENDAR.NAME,
    Calendar._fields.TITLE,
    Calendar._fields.MESSAGE,
    Calendar._fields.LOCATION,
    Calendar._fields.STARTDATE,
    Calendar._fields.ENDDATE,
    Calendar._fields.ALLDAY,
    Calendar._fields.RRULE,
    Calendar._fields.BEGIN,
    Calendar._fields.END
  ];

  const sortOrder = android.provider.CalendarContract.Instances.BEGIN + " ASC, " + android.provider.CalendarContract.Instances.END + " ASC";
  let selection = "";
  let selections = [];

  if (settings.id !== undefined) {
    selection += Calendar._fields.EVENT_ID + " = ?";
    selections.push(settings.id);

  } else {
    if (settings.title !== undefined) {
      selection += Calendar._fields.TITLE + " LIKE ?";
      selections.push("%" + settings.title + "%");
    }
    if (settings.location !== undefined) {
      if ("" !== selection) {
        selection += " AND ";
      }
      selection += Calendar._fields.LOCATION + " LIKE ?";
      selections.push("%" + settings.location + "%");
    }
  }

  const uriBuilder = android.provider.CalendarContract.Instances.CONTENT_URI.buildUpon();
  android.content.ContentUris.appendId(uriBuilder, settings.startDate.getTime());
  android.content.ContentUris.appendId(uriBuilder, settings.endDate.getTime());
  const contentResolver = utils.ad.getApplicationContext().getContentResolver();
  const uri = uriBuilder.build();
  const cursor = contentResolver.query(
      uri,
      projection,
      selection,
      selections,
      sortOrder);

  const events = [];
  if (cursor.moveToFirst()) {
    do {
      let recurrence: Recurrence;
      // rules look like: FREQ=DAILY;INTERVAL=2;UNTIL=20180308
      const recurrenceRule: string = cursor.getString(cursor.getColumnIndex(Calendar._fields.RRULE));
      if (recurrenceRule) {
        let frequency;
        let interval;
        let count;
        let endDate = null;
        const rules: Array<string> = recurrenceRule.split(";");
        rules.forEach(rule => {
          const ruleType = rule.split("=")[0];
          const ruleValue = rule.split("=")[1];
          if (ruleType === "FREQ") {
            frequency = <RecurrenceFrequency>ruleValue.toLowerCase();
          } else if (ruleType === "INTERVAL") {
            interval = +ruleValue;
          } else if (ruleType === "UNTIL" && ruleValue.length === 8) {
            // format is YYYYMMDD
            endDate = new Date(+ruleValue.substring(0, 4), +ruleValue.substring(4, 6) - 1, +ruleValue.substring(6, 8));
          } else if (ruleType === "COUNT") {
            count = +ruleValue;
          }
        });

        recurrence = {
          frequency: frequency,
          interval: interval,
          endDate: endDate,
          count: count
        };
      }

      const event: Event = {
        id: cursor.getString(cursor.getColumnIndex(Calendar._fields.EVENT_ID)),
        title: cursor.getString(cursor.getColumnIndex(Calendar._fields.TITLE)),
        notes: cursor.getString(cursor.getColumnIndex(Calendar._fields.MESSAGE)),
        location: cursor.getString(cursor.getColumnIndex(Calendar._fields.LOCATION)),
        startDate: recurrence ? new Date(cursor.getLong(cursor.getColumnIndex(Calendar._fields.BEGIN))) : new Date(cursor.getLong(cursor.getColumnIndex(Calendar._fields.STARTDATE))),
        endDate: recurrence ? new Date(cursor.getLong(cursor.getColumnIndex(Calendar._fields.END))) : new Date(cursor.getLong(cursor.getColumnIndex(Calendar._fields.ENDDATE))),
        allDay: cursor.getInt(cursor.getColumnIndex(Calendar._fields.ALLDAY)) === 1,
        calendar: {
          id: cursor.getString(cursor.getColumnIndex(Calendar._fields.CALENDAR.ID)),
          name: cursor.getString(cursor.getColumnIndex(Calendar._fields.CALENDAR.NAME)),
          displayName: cursor.getString(cursor.getColumnIndex(Calendar._fields.CALENDAR.NAME))
        },
        recurrence: recurrence,
      };

      event.reminders = Calendar._findReminders(event.id);

      events.push(event);
    } while (cursor.moveToNext());
  }
  return events;
};

Calendar._findReminders = function (eventId) {
  const projection = [
    // Calendar._remindersFields.ID,
    // Calendar._remindersFields.EVENT_ID,
    Calendar._remindersFields.MINUTES
    // Calendar._remindersFields.METHOD
  ];

  let selection = "";
  const selectionArgs = [];
  selection += Calendar._remindersFields.EVENT_ID + " = ?";
  selectionArgs.push(eventId);

  const uriBuilder = android.provider.CalendarContract.Reminders.CONTENT_URI.buildUpon();
  const contentResolver = utils.ad.getApplicationContext().getContentResolver();
  const uri = uriBuilder.build();

  const cursor = contentResolver.query(uri, projection, selection, selectionArgs, null);

  const reminders = [];
  if (cursor.moveToFirst()) {
    do {
      const reminder = {
        // _id: cursor.getString(cursor.getColumnIndex(Calendar._remindersFields.ID)),
        minutes: cursor.getLong(cursor.getColumnIndex(Calendar._remindersFields.MINUTES))
        // method: cursor.getString(cursor.getColumnIndex(Calendar._remindersFields.METHOD))
      };
      reminders.push(reminder);
    } while (cursor.moveToNext());
  }
  return reminders;
};

export function listCalendars(arg) {
  return new Promise((resolve, reject) => {
    try {
      const onPermissionGranted = function () {
        resolve(Calendar._findCalendars());
      };

      if (!Calendar._hasReadPermission()) {
        Calendar._requestReadPermission(onPermissionGranted, reject);
        return;
      }

      onPermissionGranted();
    } catch (ex) {
      console.log("Error in Calendar.listCalendars: " + ex);
      reject(ex);
    }
  });
}

export function findEvents(arg) {
  return new Promise((resolve, reject) => {
    try {
      if (!arg.startDate || !arg.endDate) {
        reject("startDate and endDate are mandatory");
        return;
      }

      const onPermissionGranted = function () {
        resolve(Calendar._findEvents(arg));
      };

      if (!Calendar._hasReadPermission()) {
        Calendar._requestReadPermission(onPermissionGranted, reject);
        return;
      }

      onPermissionGranted();
    } catch (ex) {
      console.log("Error in Calendar.findEvents: " + ex);
      reject(ex);
    }
  });
}

export function deleteEvents(arg) {
  return new Promise((resolve, reject) => {
    try {
      if (!arg.startDate || !arg.endDate) {
        reject("startDate and endDate are mandatory");
        return;
      }

      const onPermissionGranted = function () {
        const events = Calendar._findEvents(arg);
        const ContentResolver = utils.ad.getApplicationContext().getContentResolver();
        const deletedEventIds = [];
        for (const e in events) {
          const event = events[e];
          try {
            ContentResolver.delete(android.provider.CalendarContract.Events.CONTENT_URI, "_id = ?", [event.id]);
            deletedEventIds.push(event.id);
          } catch (e) {
            console.log("Failed to delete event " + event.id + ": " + event.title + ", error: " + e);
          }
        }
        resolve(deletedEventIds);
      };

      if (!Calendar._hasReadWritePermission()) {
        Calendar._requestReadWritePermission(onPermissionGranted, reject);
        return;
      }

      onPermissionGranted();
    } catch (ex) {
      console.log("Error in Calendar.deleteEvents: " + ex);
      reject(ex);
    }
  });
}

export function createEvent(arg) {
  return new Promise((resolve, reject) => {
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
        const ContentValues = new android.content.ContentValues();
        const Events = android.provider.CalendarContract.Events;
        ContentValues.put(Calendar._fields.TIMEZONE, java.util.TimeZone.getDefault().getID());
        ContentValues.put(Calendar._fields.STARTDATE, new java.lang.Long(settings.startDate.getTime()));
        ContentValues.put(Calendar._fields.ENDDATE, new java.lang.Long(settings.endDate.getTime()));

        ContentValues.put(Calendar._fields.TITLE, settings.title);
        ContentValues.put(Calendar._fields.LOCATION, settings.location);

        // there's no separate url field, so adding it to the notes
        let description = settings.notes;
        if (settings.url) {
          if (settings.notes) {
            description += " " + settings.url;
          } else {
            description = settings.url;
          }
        }
        ContentValues.put(Calendar._fields.MESSAGE, description);
        const ContentResolver = utils.ad.getApplicationContext().getContentResolver();
        ContentValues.put(Calendar._fields.HAS_ALARM, new java.lang.Integer(settings.reminders && (settings.reminders.first || settings.reminders.second) ? 1 : 0));
        let calendarId = null;
        if (settings.calendar.name !== null) {
          const calendars = Calendar._findCalendars(settings.calendar.name);
          if (calendars.length > 0) {
            calendarId = calendars[0].id;
          } else {
            // create it
            let calUri = android.provider.CalendarContract.Calendars.CONTENT_URI;
            const calendarContentValues = new android.content.ContentValues();
            const accountName = settings.calendar.accountName || settings.calendar.name || "AccountName";
            calendarContentValues.put("account_name", accountName);
            calendarContentValues.put("account_type", "LOCAL");
            calendarContentValues.put("name", settings.calendar.name);
            calendarContentValues.put("calendar_displayName", settings.calendar.name);
            calendarContentValues.put("calendar_access_level", new java.lang.Integer(700)); // "owner"
            calendarContentValues.put("ownerAccount", accountName);
            if (settings.calendar.color && Color.isValid(settings.calendar.color)) {
              let androidColor = new Color(settings.calendar.color).android;
              calendarContentValues.put("calendar_color", new java.lang.Integer(androidColor));
            }
            calendarContentValues.put("visible", new java.lang.Integer(1));
            calendarContentValues.put("sync_events", new java.lang.Integer(1));

            calUri = calUri.buildUpon()
                .appendQueryParameter("caller_is_syncadapter", "true")
                .appendQueryParameter("account_name", accountName)
                .appendQueryParameter("account_type", "LOCAL")
                .build();
            ContentResolver.insert(calUri, calendarContentValues);
            // retrieve the calendar we've' just created
            const cals = Calendar._findCalendars(settings.calendar.name);
            if (cals.length > 0) {
              calendarId = cals[0].id;
            }
          }
        }
        if (calendarId === null) {
          calendarId = settings.calendar.id;
        }
        ContentValues.put(Calendar._fields.CALENDAR.ID, new java.lang.Integer(calendarId));

        // recurrence
        if (settings.recurrence.frequency !== null) {
          if (settings.recurrence.endDate === null) {
            ContentValues.put(Calendar._fields.RRULE, "FREQ=" + settings.recurrence.frequency.toUpperCase() + ";INTERVAL=" + settings.recurrence.interval);
          } else {
            const endDate = arg.recurrence.endDate;
            const yyyy = endDate.getFullYear().toString();
            const mm = (endDate.getMonth() + 1).toString();
            const dd = endDate.getDate().toString();
            const yyyymmdd = yyyy + (mm[1] ? mm : "0" + mm[0]) + (dd[1] ? dd : "0" + dd[0]);
            ContentValues.put(Calendar._fields.RRULE, "FREQ=" + settings.recurrence.frequency.toUpperCase() + ";INTERVAL=" + settings.recurrence.interval + ";UNTIL=" + yyyymmdd);
          }
        }

        const eventsUri = android.net.Uri.parse("content://com.android.calendar/events");
        const uri = ContentResolver.insert(eventsUri, ContentValues);
        const createdEventID = uri.getLastPathSegment();

        // now add reminders, if any
        if (settings.reminders && settings.reminders.first) {
          const firstReminderContentValues = new android.content.ContentValues();
          firstReminderContentValues.put("event_id", createdEventID);
          firstReminderContentValues.put("minutes", new java.lang.Long(settings.reminders.first));
          firstReminderContentValues.put("method", new java.lang.Integer(1));
          ContentResolver.insert(android.net.Uri.parse("content://com.android.calendar/reminders"), firstReminderContentValues);
        }
        if (settings.reminders && settings.reminders.second) {
          const secondReminderContentValues = new android.content.ContentValues();
          secondReminderContentValues.put("event_id", createdEventID);
          secondReminderContentValues.put("minutes", new java.lang.Long(settings.reminders.second));
          secondReminderContentValues.put("method", new java.lang.Integer(1));
          ContentResolver.insert(android.net.Uri.parse("content://com.android.calendar/reminders"), secondReminderContentValues);
        }
        resolve(createdEventID);
      };

      if (!Calendar._hasReadWritePermission()) {
        Calendar._requestReadWritePermission(onPermissionGranted, reject);
        return;
      }

      onPermissionGranted();
    } catch (ex) {
      console.log("Error in Calendar.createEvent: " + ex);
      reject(ex);
    }
  });
}

export function deleteCalendar(arg) {
  return new Promise((resolve, reject) => {
    try {
      if (!arg.name) {
        reject("name is mandatory");
        return;
      }

      const onPermissionGranted = function () {
        const calendars = Calendar._findCalendars(arg.name);
        let deletedCalId = null;

        if (calendars.length > 0) {
          const calUri = android.provider.CalendarContract.Calendars.CONTENT_URI;
          const ContentResolver = utils.ad.getApplicationContext().getContentResolver();

          // syntactically this is a loop but there's most likely only 1 item
          for (const c in calendars) {
            const calendar = calendars[c];
            try {
              ContentResolver.delete(calUri, "_id = ?", ["" + calendar.id]);
              deletedCalId = calendar.id;
            } catch (e) {
              reject(e);
            }
          }
        }

        resolve(deletedCalId);
      };

      if (!Calendar._hasReadWritePermission()) {
        Calendar._requestReadWritePermission(onPermissionGranted, reject);
        return;
      }

      onPermissionGranted();
    } catch (ex) {
      console.log("Error in Calendar.deleteCalendar: " + ex);
      reject(ex);
    }
  });
}
