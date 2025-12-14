# Script để lấy SHA-1 fingerprint cho Android
# Chạy script này trong PowerShell

Write-Host "=== Lấy SHA-1 Fingerprint cho Android ===" -ForegroundColor Green
Write-Host ""

# Tìm Java keytool
$javaPaths = @(
    "$env:JAVA_HOME\bin\keytool.exe",
    "C:\Program Files\Java\*\bin\keytool.exe",
    "C:\Program Files (x86)\Java\*\bin\keytool.exe"
)

$keytool = $null
foreach ($path in $javaPaths) {
    $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $keytool = $found.FullName
        break
    }
}

if (-not $keytool) {
    Write-Host "❌ Không tìm thấy keytool!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Vui lòng cài đặt Java JDK:" -ForegroundColor Yellow
    Write-Host "1. Tải từ: https://www.oracle.com/java/technologies/downloads/" -ForegroundColor Cyan
    Write-Host "2. Hoặc: https://adoptium.net/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Sau khi cài, thêm Java bin vào PATH hoặc chạy lại script này." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Tìm thấy keytool tại: $keytool" -ForegroundColor Green
Write-Host ""

# Đường dẫn debug keystore
$debugKeystore = "$env:USERPROFILE\.android\debug.keystore"

if (-not (Test-Path $debugKeystore)) {
    Write-Host "❌ Không tìm thấy debug.keystore tại: $debugKeystore" -ForegroundColor Red
    Write-Host ""
    Write-Host "Keystore sẽ được tạo tự động khi bạn chạy app Android lần đầu." -ForegroundColor Yellow
    Write-Host "Hoặc bạn có thể tạo bằng cách chạy:" -ForegroundColor Yellow
    Write-Host "  npx expo run:android" -ForegroundColor Cyan
    exit 1
}

Write-Host "✓ Tìm thấy debug.keystore" -ForegroundColor Green
Write-Host ""
Write-Host "Đang lấy SHA-1 fingerprint..." -ForegroundColor Yellow
Write-Host ""

# Lấy SHA-1
$output = & $keytool -list -v -keystore $debugKeystore -alias androiddebugkey -storepass android -keypass android 2>&1

if ($LASTEXITCODE -eq 0) {
    # Tìm SHA-1 trong output
    $sha1Line = $output | Select-String "SHA1:"
    if ($sha1Line) {
        $sha1 = ($sha1Line -split "SHA1:")[1].Trim()
        Write-Host "✅ SHA-1 Fingerprint:" -ForegroundColor Green
        Write-Host $sha1 -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📋 Copy SHA-1 trên và thêm vào Google Cloud Console:" -ForegroundColor Yellow
        Write-Host "   1. Vào: https://console.cloud.google.com/" -ForegroundColor Cyan
        Write-Host "   2. APIs & Services > Credentials" -ForegroundColor Cyan
        Write-Host "   3. Tạo/chỉnh sửa Android OAuth Client" -ForegroundColor Cyan
        Write-Host "   4. Thêm SHA-1 fingerprint" -ForegroundColor Cyan
        Write-Host "   5. Package name: com.trant.myapp" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Không tìm thấy SHA-1 trong output" -ForegroundColor Red
        Write-Host $output
    }
} else {
    Write-Host "❌ Lỗi khi chạy keytool:" -ForegroundColor Red
    Write-Host $output
}

