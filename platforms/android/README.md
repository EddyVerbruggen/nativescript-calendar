To merge plugin-specific permissions with the app's `AndroidManifest.xml` an `.aar` is needed.

Add the correct permissions to [the libraryproject's manifest](libraryproject/calendarpermissions/src/main/AndroidManifest.xml) and build it.

Steps to update the `.aar` file:

* Clone this repo
* Start Android Studio and pick 'import existing project' > `{this repo}/platforms/android/libraryproject`
* Update `calendarpermissions/src/main/AndroidManifest.xml` as needed
* Open the Gradle toolwindow
* Run calendarpermissions > Tasks > build > build
* The (release) .aar will be generated in `libraryproject/calendarpermissions/build/outputs/aar`
* Copy that to the `platforms/android` folder, replacing the old `.aar`
* Commit and push the changes as usual