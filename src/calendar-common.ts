export const Calendar: any = {
  defaults: {
//   id: null, // for searching
//   title: null,
//   location: null,
//   notes: null,
//   url: null,
    reminders: {
      first: 60, // 60 minutes before the event
      second: null // no second reminder
    },
    recurrence: {
      frequency: null,
      interval: 1, // if frequency is DAILY, then 1 = every day, 2 = every other day
      endDate: null
    },
    calendar: {
      id: 1,
      name: null,
      color: null
    }
  },

  merge: (obj1, obj2) => {
    const result = {}; // return result
    for (let i in obj1) {      // for every property in obj1
      if ((i in obj2) && (typeof obj1[i] === "object") && (i !== null)) {
        result[i] = Calendar.merge(obj1[i], obj2[i]); // if it's an object, merge
      } else {
        result[i] = obj1[i]; // add it to result
      }
    }
    for (let i in obj2) { // add the remaining properties from object 2
      if (i in result) { //conflict
        continue;
      }
      result[i] = obj2[i];
    }
    return result;
  }
};

export enum RecurrenceFrequency {
  DAILY = <any>"daily",
  WEEKLY = <any>"weekly",
  MONTHLY = <any>"monthly",
  YEARLY = <any>"yearly"
}
