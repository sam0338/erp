' SAKAAR ERP — Silent Launcher
' ================================
' Starts the Node server completely in the background (no visible console
' window — this is the "executor" that runs the app behind the scenes),
' waits a moment for it to come up, then opens the default browser to it.
' Double-clicking the Desktop/Start Menu shortcut runs this file.

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strNodeExe = strAppDir & "\node\node.exe"
strServerJs = strAppDir & "\app\server.js"
strWorkDir = strAppDir & "\app"

' Data lives under %PROGRAMDATA%, not inside the install folder — survives
' an uninstall/reinstall/upgrade, and doesn't need admin rights to write to.
strDataDir = objShell.ExpandEnvironmentStrings("%PROGRAMDATA%") & "\SAKAAR ERP\data"
If Not objFSO.FolderExists(strDataDir) Then
  objFSO.CreateFolder(objShell.ExpandEnvironmentStrings("%PROGRAMDATA%") & "\SAKAAR ERP")
  objFSO.CreateFolder(strDataDir)
End If
objShell.Environment("PROCESS")("DB_DIR") = strDataDir

' 0 = fully hidden window, False = don't wait for it to exit (it's a server)
objShell.CurrentDirectory = strWorkDir
objShell.Run """" & strNodeExe & """ """ & strServerJs & """", 0, False

' Give the server a moment to bind its port before opening the browser.
WScript.Sleep 1800

objShell.Run "http://localhost:3000", 1, False
