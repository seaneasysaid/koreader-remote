@echo off
set ADB=E:\mumu\MuMuPlayer\nx_device\12.0\shell\adb.exe
set APK=D:\DSworkspace\koreader-apk\out\koreader-remote.apk
set HOME=D:\DSworkspace\koreader-apk\build\.android
set ANDROID_SDK_HOME=%HOME%
set ANDROID_USER_HOME=%HOME%
"%ADB%" connect 127.0.0.1:16384
"%ADB%" -s 127.0.0.1:16384 install -r "%APK%"
