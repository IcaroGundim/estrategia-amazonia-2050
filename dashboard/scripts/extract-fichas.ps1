param(
  [string]$InputDocx = '',
  [string]$OutputJson = (Join-Path $PSScriptRoot '..\public\data\fichas.json')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

$codes = @(
  'I1.1.1', 'I1.1.2', 'I1.1.3',
  'I1.2.1', 'I1.2.2',
  'I1.3.1', 'I1.3.2', 'I1.3.3', 'I1.3.4', 'I1.3.5', 'I1.3.6', 'I1.3.7', 'I1.3.8',
  'I1.4.1', 'I1.4.2',
  'I1.5.1', 'I1.5.5', 'I1.5.8',
  'I2.1.1', 'I2.1.2',
  'I2.2.1', 'I2.2.2', 'I2.2.3',
  'I2.3.1', 'I2.3.2',
  'I2.4.1', 'I2.4.2',
  'I2.5.1',
  'I3.1.1', 'F3.2',
  'I3.3.1', 'I3.3.2', 'I3.3.3',
  'I3.4.1', 'I3.4.2',
  'F3.5', 'I3.5.2',
  'I4.1.1', 'I4.2.1', 'I4.3.1', 'I4.3.2', 'I4.4.1', 'I4.4.2',
  'I5.1.1', 'I5.2.1', 'I5.2.2', 'I5.3.1', 'I5.3.2', 'I5.4.1', 'I5.5.1', 'I5.5.2', 'I5.5.3'
)

function Normalize-Label([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
  $valueFormD = $Value.Normalize([Text.NormalizationForm]::FormD)
  $builder = [Text.StringBuilder]::new()
  foreach ($char in $valueFormD.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }
  return (($builder.ToString().Normalize([Text.NormalizationForm]::FormC) -replace '\s+', ' ').Trim().ToLowerInvariant())
}

function Cell-Text($Cell, $NamespaceManager) {
  $paragraphs = foreach ($paragraph in $Cell.SelectNodes('.//w:p', $NamespaceManager)) {
    $parts = $paragraph.SelectNodes('.//w:t | .//m:t', $NamespaceManager) | ForEach-Object { $_.InnerText }
    $line = (($parts -join '') -replace '\s+', ' ').Trim()
    if ($line) { $line }
  }
  return ($paragraphs -join "`n").Trim()
}

function Get-Field($Fields, [string[]]$Names) {
  foreach ($name in $Names) {
    $key = Normalize-Label $name
    if ($Fields.Contains($key)) { return [string]$Fields[$key] }
  }
  return ''
}

if (-not $InputDocx) {
  $projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
  $source = Get-ChildItem -LiteralPath $projectRoot -Filter 'Fichas T*cnicas Indicadores - Amazonia2050.docx' | Select-Object -First 1
  if ($null -eq $source) { throw 'Arquivo de fichas tecnicas nao encontrado na raiz do projeto.' }
  $InputDocx = $source.FullName
}

$resolvedInput = (Resolve-Path -LiteralPath $InputDocx).Path
$zip = [IO.Compression.ZipFile]::OpenRead($resolvedInput)
try {
  $entry = $zip.GetEntry('word/document.xml')
  if ($null -eq $entry) { throw 'O DOCX nao contem word/document.xml.' }
  $reader = [IO.StreamReader]::new($entry.Open())
  try { [xml]$document = $reader.ReadToEnd() } finally { $reader.Dispose() }

  $ns = [Xml.XmlNamespaceManager]::new($document.NameTable)
  $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  $ns.AddNamespace('m', 'http://schemas.openxmlformats.org/officeDocument/2006/math')

  $tables = $document.SelectNodes('//w:tbl', $ns)
  if ($tables.Count -ne $codes.Count) {
    throw "Foram encontradas $($tables.Count) fichas, mas o mapa possui $($codes.Count) codigos. Revise o documento e o mapa antes de exportar."
  }

  $fichas = [ordered]@{}
  for ($index = 0; $index -lt $tables.Count; $index++) {
    $fields = [ordered]@{}
    foreach ($row in $tables[$index].SelectNodes('./w:tr', $ns)) {
      $cells = $row.SelectNodes('./w:tc', $ns)
      if ($cells.Count -lt 2) { continue }
      $label = Normalize-Label (Cell-Text $cells[0] $ns)
      if (-not $label) { continue }
      $fields[$label] = Cell-Text $cells[1] $ns
    }

    $referenceText = Get-Field $fields @('Referencia (Link)', 'Referencia Link', 'Referencia', 'Fonte')
    $references = @([regex]::Matches($referenceText, 'https?://[^\s|]+') | ForEach-Object { $_.Value.TrimEnd('.', ',', ';', ')') } | Select-Object -Unique)

    $fichas[$codes[$index]] = [ordered]@{
      eixo = Get-Field $fields @('Eixo')
      linhaAcao = Get-Field $fields @('Linha de Acao')
      meta = Get-Field $fields @('META ajustada', 'META')
      indicador = Get-Field $fields @('Indicador', 'Indicador ajustado')
      prazo = Get-Field $fields @('Prazo')
      # Quatro fichas do Eixo 4 trazem "Formula ajustada" no lugar de "Formula": sem o
      # apelido, o metodo de calculo delas sai vazio para o painel. A linha "Definicao"
      # do I4.4.2 fica de fora de proposito - ela conceitua cidades resilientes, nao
      # descreve um calculo.
      formula = Get-Field $fields @('Formula', 'Formula ajustada')
      unidade = Get-Field $fields @('Unidade')
      fontes = Get-Field $fields @('Fontes')
      frequencia = Get-Field $fields @('Frequencia de medicao')
      pontuacao = Get-Field $fields @('Pontuacao')
      referencias = $references
    }
  }

  $payload = [ordered]@{
    fonte = [IO.Path]::GetFileName($resolvedInput)
    total = $fichas.Count
    fichas = $fichas
  }
  $json = $payload | ConvertTo-Json -Depth 8
  $resolvedOutput = [IO.Path]::GetFullPath($OutputJson)
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($resolvedOutput)) | Out-Null
  [IO.File]::WriteAllText($resolvedOutput, $json + "`n", [Text.UTF8Encoding]::new($false))
  Write-Output "Exportadas $($fichas.Count) fichas para $resolvedOutput"
}
finally {
  $zip.Dispose()
}
