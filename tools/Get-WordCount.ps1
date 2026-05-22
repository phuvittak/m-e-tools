<#
.SYNOPSIS
    Counts the number of words in a text file.

.DESCRIPTION
    Reads a text file and prints the number of whitespace-separated words it
    contains. Useful as a quick word-count check from the command line.

.PARAMETER Path
    Path to the text file to count words in.

.EXAMPLE
    .\Get-WordCount.ps1 -Path notes.txt
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

if (-not (Test-Path $Path)) {
    Write-Error "File not found: $Path"
    exit 1
}

$words = (Get-Content -Path $Path -Raw) -split '\s+' | Where-Object { $_ -ne '' }
Write-Output $words.Count
