var utils = require("utils/utils");
var application = require("application");
var frame = require("ui/frame");
var Calendar = require("./calendar-common");

Calendar._findEvents = function(arg) {
  var projection = [Calendars._ID]; // TODO add others
  var sortOrder = Instances.BEGIN + " ASC, " + Instances.END + " ASC";
  console.log("---- sort order: " + sortOrder);
  var selection = "";
  var selections = [];

  if (arg.title != null) {
    selection += Events.TITLE + " LIKE ?";
    selections.push("%" + arg.title + "%");
  }
  if (arg.location != null) {
    if (!"".equals(selection)) {
      selection += " AND ";
    }
    selection += Events.EVENT_LOCATION + " LIKE ?";
    selections.push("%" + arg.location + "%");
  }
  var cursor = queryEventInstances(
    arg.startDate.getTime(),
    arg.endDate.getTime(),
    projection,
    selection,
    selections,
    sortOrder);
  
  var events = [];
  if (cursor.moveToFirst()) {
    var colId = cursor.getColumnIndex(Calendars._ID);
    console.log("--- colId " + colId);
    do {
      var event = new Event();
      event.id = cursor.getString(colId);
      events.push(event);
      console.log("--- found event with id " + event.id);
    } while (cursor.moveToNext());
  }
  return events;
}

Calendar.findEvents = function(arg) {
  return new Promise(function (resolve, reject) {
    try {
      // TODO permission stuff, see Calendar.java#381
      resolve(Calendar._findEvents(arg));
    } catch (ex) {
      console.log("Error in Calendar.findEvents: " + ex);
      reject(ex);
    }
  });
};

Calendar.createEvent = function(arg) {
  return new Promise(function (resolve, reject) {
    try {
      // TODO permission stuff, see Calendar.java#413
      var contentValues = new ContentValues();
      var allDayEvent = false; // TODO see AbsCalAcc.java#436
      if (allDayEvent) {
        // TODO
      } else {
        contentValues.put(Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
        contentValues.put(Events.DTSTART, arg.startDate);
        contentValues.put(Events.DTEND, arg.endDate);
      }
      contentValues.put(Events.ALL_DAY, allDayEvent ? 1 : 0);
      contentValues.put(Events.TITLE, arg.title);
      contentValues.put(Events.EVENT_LOCATION, arg.location);
      // there's no separate url field, so adding it to the notes
      var description = arg.notes;
      if (arg.url != null) {
        if (arg.notes == null) {
          description = arg.url;
        } else {
          description += " " + arg.url;
        }
      }
      contentValues.put(Events.DESCRIPTION, description);
      // TODO
      // contentValues.put(Events.HAS_ALARM, (firstReminderMinutes == null && secondReminderMinutes == null) ? 0 : 1);
      // contentValues.put(Events.CALENDAR_ID, calendarId);
      // TODO recur
      var activity = application.android.foregroundActivity;
      var contentResolver = activity.getContentResolver();
      var eventsUri = Uri.parse("content://com.android.calendar/events");
      var uri = contentResolver.insert(eventsUri, contentValues);
      var createdEventID = uri.getLastPathSegment();
      console.log("--- created event " + createdEventID);
      resolve(createdEventID);
    } catch (ex) {
      console.log("Error in Calendar.createEvent: " + ex);
      reject(ex);
    }
  });
};

module.exports = Calendar;