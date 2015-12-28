var Calendar = {};

Calendar.RecurrenceFrequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
};

Calendar.defaults = {
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
    interval: null, // if frequency is DAILY, then 1 = every day, 2 = every other day 
    endDate: null
  },
  calendar: {
    id: 1,
    name: null,
    color: null
  }
};

Calendar.merge = function merge(obj1, obj2){ // Our merge function
  var result = {}; // return result
  for(var i in obj1){      // for every property in obj1
    if((i in obj2) && (typeof obj1[i] === "object") && (i !== null)){
      result[i] = merge(obj1[i],obj2[i]); // if it's an object, merge
    }else{
      result[i] = obj1[i]; // add it to result
    }
  }
  for(i in obj2){ // add the remaining properties from object 2
    if(i in result){ //conflict
      continue;
    }
    result[i] = obj2[i];
  }
  return result;
};

module.exports = Calendar;