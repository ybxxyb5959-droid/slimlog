# SlimLog - AI Hub 라벨 zip 점검 (Windows 기본 PowerShell 5.1 이상, 설치 필요 없음)
# 사용: check_labels.bat 위에 zip 파일을 끌어다 놓기
# - zip 을 풀지 않고 안에서 바로 읽는다 (원본 폴더에 아무것도 안 씀)
# - 결과는 이 파일 옆 result_send_me.txt 로 저장, 사진·원본은 담지 않음

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Zips)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$MaxJsonPerZip = 3000      # zip 하나에서 읽을 JSON 최대 개수 (속도용)
$RawPreviewLines = 40      # 첫 JSON 미리보기 줄 수
$NameKeyPattern = '(?i)(name|class|label|category|code|food|음식|이름|분류)'

$BoxKeyPattern = '(?i)^(bbox|box|boxes|point|points|polygon|segmentation|x|y|w|h|x1|y1|x2|y2|xmin|ymin|xmax|ymax|width|height|좌표)$'

$out = New-Object System.Collections.Generic.List[string]
$GlobalNameFiles = @{}   # 모든 zip 합계: 이름 경로 -> 값 -> 등장 사진 수
$GlobalRead = 0; $GlobalTotal = 0
function Say([string]$s) { $out.Add($s); Write-Host $s }

function Cut([string]$s, [int]$n) {
    if ($null -eq $s) { return '' }
    $s = $s -replace '\s+', ' '
    if ($s.Length -gt $n) { return $s.Substring(0, $n) + '...' }
    return $s
}

function Bump($table, $key) {
    if ($table.ContainsKey($key)) { $table[$key]++ } else { $table[$key] = 1 }
}

# JSON 트리 순회: 경로별 등장, 배열 길이, 이름 같아 보이는 값 수집
function Walk($node, [string]$path, $seenPaths, $arrayLens, $nameVals, $samples) {
    if ($null -eq $node) { return }
    if ($node -is [System.Management.Automation.PSCustomObject]) {
        foreach ($p in $node.PSObject.Properties) {
            $child = if ($path) { "$path.$($p.Name)" } else { $p.Name }
            Walk $p.Value $child $seenPaths $arrayLens $nameVals $samples
        }
        return
    }
    if ($node -is [System.Collections.IList] -and -not ($node -is [string])) {
        $ap = "$path[]"
        if (-not $arrayLens.ContainsKey($ap)) { $arrayLens[$ap] = @{} }
        Bump $arrayLens[$ap] ([int]$node.Count)
        foreach ($item in $node) { Walk $item $ap $seenPaths $arrayLens $nameVals $samples }
        return
    }
    # 값(leaf)
    $seenPaths[$path] = $true
    if (-not $samples.ContainsKey($path)) { $samples[$path] = Cut ([string]$node) 40 }
    $last = ($path -split '\.')[-1] -replace '\[\]', ''
    if ($node -is [string] -and $last -match $NameKeyPattern) {
        if (-not $nameVals.ContainsKey($path)) { $nameVals[$path] = @{} }
        Bump $nameVals[$path] $node
        $seenPaths["VAL`t$path`t$node"] = $true   # 파일(=사진)별로 어떤 음식이 나왔는지
    }
}

function ReadEntryText($entry) {
    $stream = $entry.Open()
    try {
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $true)
        return $reader.ReadToEnd()
    } finally { $stream.Dispose() }
}

Say "SlimLog 라벨 점검 결과  ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
Say "PowerShell $($PSVersionTable.PSVersion)"
Say ''

if (-not $Zips -or $Zips.Count -eq 0) {
    Say '[안내] zip 파일을 check_labels.bat 위에 끌어다 놓아 주세요.'
}

foreach ($zipPath in $Zips) {
    Say ('=' * 60)
    Say "파일: $([System.IO.Path]::GetFileName($zipPath))"
    if (-not (Test-Path -LiteralPath $zipPath)) { Say '  [오류] 파일이 없음'; continue }
    if ([System.IO.Path]::GetExtension($zipPath) -ne '.zip') { Say '  [건너뜀] zip 이 아님'; continue }

    try { $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath) }
    catch { Say "  [오류] zip 을 열 수 없음: $($_.Exception.Message)"; continue }

    try {
        $entries = @($zip.Entries | Where-Object { $_.Length -gt 0 })
        $byExt = @{}
        foreach ($e in $entries) {
            $ext = [System.IO.Path]::GetExtension($e.FullName).ToLower()
            if (-not $ext) { $ext = '(없음)' }
            Bump $byExt $ext
        }
        Say "  파일 수: $($entries.Count)"
        Say ('  확장자별: ' + (($byExt.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '))

        Say '  앞쪽 파일 이름 10개:'
        $entries | Select-Object -First 10 | ForEach-Object { Say ("    {0}  ({1:N0} KB)" -f $_.FullName, [math]::Ceiling($_.Length / 1KB)) }

        $jsons = @($entries | Where-Object { $_.FullName -match '(?i)\.json$' })
        if ($jsons.Count -eq 0) { Say '  JSON 없음 (라벨 zip 이 아닌 듯)'; continue }

        # 첫 JSON 원문 미리보기
        Say ''
        Say "  [첫 JSON 미리보기] $($jsons[0].FullName)"
        $firstText = ReadEntryText $jsons[0]
        $lines = $firstText -split "`r?`n"
        if ($lines.Count -le 3) {
            # 한 줄짜리 JSON 이면 보기 좋게 다시 펼침
            try { $lines = ((ConvertFrom-Json $firstText) | ConvertTo-Json -Depth 12) -split "`r?`n" } catch {}
        }
        $lines | Select-Object -First $RawPreviewLines | ForEach-Object { Say ('    ' + (Cut $_ 160)) }
        if ($lines.Count -gt $RawPreviewLines) { Say "    ... (총 $($lines.Count)줄)" }

        # 여러 파일 집계
        $pathFiles = @{}; $arrayLens = @{}; $nameVals = @{}; $samples = @{}
        $nameFiles = @{}; $distinctDist = @{}
        $ok = 0; $bad = 0
        $take = [math]::Min($jsons.Count, $MaxJsonPerZip)
        for ($i = 0; $i -lt $take; $i++) {
            try {
                $obj = ConvertFrom-Json (ReadEntryText $jsons[$i])
                $seen = @{}
                Walk $obj '' $seen $arrayLens $nameVals $samples
                $perFile = @{}
                foreach ($k in @($seen.Keys)) {
                    if ($k.StartsWith("VAL`t")) {
                        $parts = $k.Split("`t")
                        $np = $parts[1]; $v = $parts[2]
                        if (-not $nameFiles.ContainsKey($np)) { $nameFiles[$np] = @{} }
                        Bump $nameFiles[$np] $v
                        if (-not $GlobalNameFiles.ContainsKey($np)) { $GlobalNameFiles[$np] = @{} }
                        Bump $GlobalNameFiles[$np] $v
                        Bump $perFile $np
                    } else { Bump $pathFiles $k }
                }
                foreach ($np in @($perFile.Keys)) {
                    if (-not $distinctDist.ContainsKey($np)) { $distinctDist[$np] = @{} }
                    Bump $distinctDist[$np] ([int]$perFile[$np])
                }
                $ok++
            } catch { $bad++ }
            if (($i + 1) % 500 -eq 0) { Write-Host "    ...$($i + 1)/$take 읽는 중" }
        }
        $GlobalRead += $ok; $GlobalTotal += $jsons.Count
        Say ''
        Say "  [집계] JSON $($jsons.Count)개 중 $take 개 읽음 (성공 $ok, 실패 $bad)"
        if ($take -lt $jsons.Count) { Say "  ※ 앞쪽 $take 개만 읽은 샘플 기준 숫자임 (전체 수량 아님)" }

        $boxKeys = @($pathFiles.Keys | Where-Object { (($_ -split '\.')[-1] -replace '\[\]', '') -match $BoxKeyPattern })
        if ($boxKeys.Count -gt 0) { Say ('  박스(위치) 같아 보이는 키: ' + (($boxKeys | Sort-Object) -join ', ')) }
        else { Say '  박스(위치) 같아 보이는 키: 못 찾음' }

        Say '  키 목록 (등장 파일 수 / 예시 값):'
        $pathFiles.GetEnumerator() | Sort-Object Name | Select-Object -First 80 | ForEach-Object {
            Say ("    {0}  [{1}]  예: {2}" -f $_.Key, $_.Value, $samples[$_.Key])
        }

        Say '  배열 길이 분포 (사진 1장에 음식 여러 개인지 보는 용도):'
        foreach ($ap in ($arrayLens.Keys | Sort-Object)) {
            $dist = $arrayLens[$ap].GetEnumerator() | Sort-Object { [int]$_.Key } | Select-Object -First 12 |
                ForEach-Object { "길이$($_.Key)=$($_.Value)" }
            Say ("    {0}: {1}" -f $ap, ($dist -join ', '))
        }

        Say '  이름처럼 보이는 값 (상위 30개, 박스 수 / 사진 수):'
        foreach ($np in ($nameVals.Keys | Sort-Object)) {
            $t = $nameVals[$np]
            Say ("    {0}  (서로 다른 값 {1}개)" -f $np, $t.Count)
            $t.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 30 |
                ForEach-Object { Say ("      {0} : 박스 {1} / 사진 {2}" -f (Cut $_.Key 40), $_.Value, $nameFiles[$np][$_.Key]) }
            if ($distinctDist.ContainsKey($np)) {
                $dd = $distinctDist[$np].GetEnumerator() | Sort-Object { [int]$_.Key } | ForEach-Object { "$($_.Key)종=$($_.Value)장" }
                Say ('      사진 1장당 서로 다른 값 개수: ' + ($dd -join ', '))
            }
        }
    } finally { $zip.Dispose() }
    Say ''
}

if ($GlobalNameFiles.Count -gt 0 -and $Zips.Count -gt 1) {
    Say ('=' * 60)
    Say "[전체 합계] 읽은 JSON $GlobalRead 개 / 전체 $GlobalTotal 개"
    foreach ($np in ($GlobalNameFiles.Keys | Sort-Object)) {
        $t = $GlobalNameFiles[$np]
        Say ("  {0}  (서로 다른 값 {1}개) — 값별 사진 수 상위 100" -f $np, $t.Count)
        $t.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 100 |
            ForEach-Object { Say ("    {0} : {1}" -f (Cut $_.Key 40), $_.Value) }
    }
    Say ''
}

$resultPath = Join-Path $PSScriptRoot 'result_send_me.txt'
$out | Out-File -FilePath $resultPath -Encoding UTF8
Say "저장됨: $resultPath"
Say '이 파일 내용을 통째로 복사해서 채팅에 붙여 주세요.'
try { Start-Process notepad.exe -ArgumentList "`"$resultPath`"" } catch {}
