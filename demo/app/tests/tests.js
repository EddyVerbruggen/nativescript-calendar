var Calendar = require("nativescript-calendar");

describe("hasPermission", function () {
  it("exists", function () {
    expect(Calendar.hasPermission).toBeDefined();
  });

  it("returns a boolean", function () {
    expect(Calendar.hasPermission()).toEqual(false);
  });
});