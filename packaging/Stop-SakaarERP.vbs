' SAKAAR ERP — Stop Script
' ===========================
' Used by the uninstaller (and available as its own shortcut) to stop the
' background server before removing files or applying an update. Matches
' on the exact server.js path so it never touches an unrelated Node process
' the user might have running for something else.

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strServerJs = strAppDir & "\app\server.js"

strQuery = "Get-CimInstance Win32_Process -Filter ""Name='node.exe'"" | " & _
  "Where-Object { $_.CommandLine -like '*" & Replace(strServerJs, "\", "\\") & "*' } | " & _
  "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"

objShell.Run "powershell.exe -NoProfile -Command """ & strQuery & """", 0, True
