' VEDA Pharmacy — Silent Launcher
' ================================
' Starts the Node server completely in the background (no visible console
' window — this is the "executor" that runs the app behind the scenes),
' initializing the database automatically on the very first run, then
' opens the default browser to the login page. Double-clicking the
' Desktop/Start Menu shortcut runs this file. The only thing left for the
' person in front of the browser to do is type in their login credentials.

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strNodeExe = strAppDir & "\node\node.exe"
strAppSubDir = strAppDir & "\app"
strServerJs = strAppSubDir & "\server.js"
strInitJs = strAppSubDir & "\db\init.js"

' Data lives under %PROGRAMDATA%, not inside the install folder — survives
' an uninstall/reinstall/upgrade, and doesn't need admin rights to write to.
strDataDir = objShell.ExpandEnvironmentStrings("%PROGRAMDATA%") & "\VEDA Pharmacy\data"
If Not objFSO.FolderExists(strDataDir) Then
  objFSO.CreateFolder(objShell.ExpandEnvironmentStrings("%PROGRAMDATA%") & "\VEDA Pharmacy")
  objFSO.CreateFolder(strDataDir)
End If
objShell.Environment("PROCESS")("DB_DIR") = strDataDir

' Prescription photos (Schedule H1/X sales) also live under %PROGRAMDATA%,
' for the same reason as DB_DIR above.
strUploadDir = objShell.ExpandEnvironmentStrings("%PROGRAMDATA%") & "\VEDA Pharmacy\uploads\rx"
If Not objFSO.FolderExists(strUploadDir) Then
  objFSO.CreateFolder(objShell.ExpandEnvironmentStrings("%PROGRAMDATA%") & "\VEDA Pharmacy\uploads")
  objFSO.CreateFolder(strUploadDir)
End If
objShell.Environment("PROCESS")("UPLOAD_DIR") = strUploadDir

' A persistent, randomly-generated session secret — generated once on first
' run (using the bundled Node's own crypto module, so it's a real
' cryptographically random value, not a weak VBScript Rnd()) and reused on
' every later launch so restarting the app doesn't invalidate open sessions.
strSecretFile = strDataDir & "\session.secret"
If Not objFSO.FileExists(strSecretFile) Then
  Set objExec = objShell.Exec(Chr(34) & strNodeExe & Chr(34) & _
    " -e ""console.log(require('crypto').randomBytes(48).toString('hex'))""")
  strSecret = Trim(objExec.StdOut.ReadAll())
  Set objSecretFile = objFSO.CreateTextFile(strSecretFile, True)
  objSecretFile.Write strSecret
  objSecretFile.Close
Else
  Set objSecretFile = objFSO.OpenTextFile(strSecretFile, 1)
  strSecret = Trim(objSecretFile.ReadAll())
  objSecretFile.Close
End If
objShell.Environment("PROCESS")("SESSION_SECRET") = strSecret

objShell.CurrentDirectory = strAppSubDir

' First run ever: the database doesn't exist yet under strDataDir, so
' create and seed it (schema, default store, admin user, 7-day trial clock)
' before starting the server — equivalent to "npm run initdb", just run
' automatically instead of by hand.
If Not objFSO.FileExists(strDataDir & "\veda_pharmacy.db") Then
  objShell.Run Chr(34) & strNodeExe & Chr(34) & " " & Chr(34) & strInitJs & Chr(34), 0, True
End If

' 0 = fully hidden window, False = don't wait for it to exit (it's a server)
objShell.Run Chr(34) & strNodeExe & Chr(34) & " " & Chr(34) & strServerJs & Chr(34), 0, False

' Give the server a moment to bind its port before opening the browser.
WScript.Sleep 1800

objShell.Run "http://localhost:4600/login.html", 1, False
