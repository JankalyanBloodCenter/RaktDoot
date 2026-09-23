$ErrorActionPreference = "Stop"

$buildTools = "C:\Users\priyanka.davhare\AppData\Local\Android\Sdk\build-tools\36.1.0"
$apksigner  = Join-Path $buildTools "apksigner.bat"
$zipalign   = Join-Path $buildTools "zipalign.exe"
$keystore   = "d:\raktdoot\RaktDoot\scratch\debug.keystore"
$apkPath    = "d:\raktdoot\RaktDoot\backend\public\downloads\raktdoot-driver.apk"
$tempDir    = "d:\raktdoot\RaktDoot\scratch\apk_extract"
$tempZip    = "d:\raktdoot\RaktDoot\scratch\patched.zip"
$tempAligned= "d:\raktdoot\RaktDoot\scratch\aligned.apk"
$signedApk  = "d:\raktdoot\RaktDoot\scratch\raktdoot-driver-new.apk"

Write-Host "1. Making backup of original APK..."
Copy-Item $apkPath "d:\raktdoot\RaktDoot\scratch\raktdoot-driver-backup.apk" -Force

Write-Host "2. Reading bundle from APK..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$zip = [System.IO.Compression.ZipFile]::Open($apkPath, [System.IO.Compression.ZipArchiveMode]::Update)
$entry = $zip.GetEntry("assets/index.android.bundle")

$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
$content = $reader.ReadToEnd()
$reader.Close()
$stream.Close()

$oldUrl = "raktdoot-backend-hba8.onrender.com"
$newUrl = "raktdoot-backend-g8fz.onrender.com"

if (-not $content.Contains($oldUrl)) {
    Write-Host "WARNING: oldUrl not found in bundle! May already be patched."
} else {
    Write-Host "Found oldUrl! Replacing with $newUrl..."
    $content = $content.Replace($oldUrl, $newUrl)
    
    # Delete old entry and recreate with stored compression
    $entry.Delete()
    $newEntry = $zip.CreateEntry("assets/index.android.bundle", [System.IO.Compression.CompressionLevel]::NoCompression)
    $writerStream = $newEntry.Open()
    $writer = New-Object System.IO.StreamWriter($writerStream, [System.Text.Encoding]::UTF8)
    $writer.Write($content)
    $writer.Close()
    $writerStream.Close()
    Write-Host "Replaced assets/index.android.bundle successfully."
}

$zip.Dispose()

Write-Host "3. Aligning with zipalign..."
if (Test-Path $tempAligned) { Remove-Item $tempAligned -Force }
& $zipalign -p -f 4 $apkPath $tempAligned

Write-Host "4. Signing with apksigner (v1, v2, v3 schemes)..."
if (Test-Path $signedApk) { Remove-Item $signedApk -Force }
& $apksigner sign --ks $keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --min-sdk-version 21 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out $signedApk $tempAligned

Write-Host "5. Verifying signature..."
& $apksigner verify --verbose --min-sdk-version 21 $signedApk

Write-Host "6. Moving newly signed APK to backend/public/downloads..."
Copy-Item $signedApk $apkPath -Force

$item = Get-Item $apkPath
Write-Host "DONE! Final APK size: $($item.Length) bytes ($([math]::Round($item.Length / 1MB, 2)) MB)"
