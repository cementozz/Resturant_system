param([string]$InputFile,[string]$OutputFile,[ValidateSet('List','Raster','Windows','Raw')][string]$Mode='List')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
if($Mode -eq 'List') { ConvertTo-Json -InputObject @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters | ForEach-Object { @{name=$_} }) -Compress; exit }
$document=Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
if($Mode -eq 'Raw') {
Add-Type @'
using System;using System.Runtime.InteropServices;
public class TrackBiteRawPrinter {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public class DOCINFO { public string pDocName="Track Bite";public string pOutputFile=null;public string pDataType="RAW"; }
 [DllImport("winspool.drv",EntryPoint="OpenPrinterW",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool OpenPrinter(string name,out IntPtr h,IntPtr defaults);
 [DllImport("winspool.drv",EntryPoint="StartDocPrinterW",CharSet=CharSet.Unicode,SetLastError=true)] static extern int StartDocPrinter(IntPtr h,int level,[In] DOCINFO doc);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool WritePrinter(IntPtr h,byte[] bytes,int length,out int written);
 [DllImport("winspool.drv")] static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.drv")] static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.drv")] static extern bool ClosePrinter(IntPtr h);
 public static void Send(string name,byte[] data) { IntPtr h;if(!OpenPrinter(name,out h,IntPtr.Zero))throw new Exception("Cannot open printer");bool doc=false,page=false;try { if(StartDocPrinter(h,1,new DOCINFO())==0)throw new Exception("Cannot start print document");doc=true;if(!StartPagePrinter(h))throw new Exception("Cannot start page");page=true;int written;if(!WritePrinter(h,data,data.Length,out written)||written!=data.Length)throw new Exception("Incomplete print write"); } finally {if(page)EndPagePrinter(h);if(doc)EndDocPrinter(h);ClosePrinter(h);} }
}
'@
 for($copy=0;$copy -lt $document.copies;$copy++){[TrackBiteRawPrinter]::Send($document.device,[IO.File]::ReadAllBytes($OutputFile))};exit
}
$width=if($document.width -eq 58){384}else{576}
$measure=New-Object Drawing.Bitmap($width,1)
$graphics=[Drawing.Graphics]::FromImage($measure)
$format=New-Object Drawing.StringFormat
if($document.language -ne 'en'){$format.FormatFlags=[Drawing.StringFormatFlags]::DirectionRightToLeft;$format.Alignment=[Drawing.StringAlignment]::Near}
$layout=New-Object 'System.Collections.Generic.List[object]'
$height=16
foreach($line in $document.lines){$font=New-Object Drawing.Font('Tahoma',[single]($line.size*2.1),$(if($line.bold){[Drawing.FontStyle]::Bold}else{[Drawing.FontStyle]::Regular}),[Drawing.GraphicsUnit]::Pixel);$size=$graphics.MeasureString([string]$line.text,$font,$width-20,$format);$lineHeight=[int][Math]::Ceiling($size.Height)+8;$layout.Add(@{text=$line.text;font=$font;y=$height;height=$lineHeight});$height+=$lineHeight}
$graphics.Dispose();$measure.Dispose()
$bitmap=New-Object Drawing.Bitmap($width,($height+20));$g=[Drawing.Graphics]::FromImage($bitmap);$g.Clear([Drawing.Color]::White);$g.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
foreach($line in $layout){$rect=New-Object Drawing.RectangleF(10,$line.y,($width-20),$line.height);$g.DrawString([string]$line.text,$line.font,[Drawing.Brushes]::Black,$rect,$format);$line.font.Dispose()};$g.Dispose();$format.Dispose()
if($Mode -eq 'Windows'){
 $print=New-Object Drawing.Printing.PrintDocument;$print.PrinterSettings.PrinterName=$document.device
 if(-not $print.PrinterSettings.IsValid){throw 'The configured Windows printer is not installed'}
 $print.PrinterSettings.Copies=[int16]$document.copies;$print.PrintController=New-Object Drawing.Printing.StandardPrintController
 $paperWidth=[int][Math]::Ceiling($document.width/25.4*100);$paperHeight=[int][Math]::Ceiling(($height+20)/203*100)
 $print.DefaultPageSettings.PaperSize=New-Object Drawing.Printing.PaperSize('Track Bite',$paperWidth,$paperHeight)
 $print.DefaultPageSettings.Margins=New-Object Drawing.Printing.Margins(0,0,0,0)
 $print.add_PrintPage({param($sender,$eventArgs)$eventArgs.Graphics.DrawImage($bitmap,0,0,[single]($width/203*100),[single](($height+20)/203*100));$eventArgs.HasMorePages=$false})
 $print.Print();$print.Dispose();$bitmap.Dispose();exit
}
# ESC/POS GS v 0 raster: Arabic has already been shaped by Windows font rendering.
$bytes=New-Object 'System.Collections.Generic.List[byte]';$bytes.AddRange([byte[]](27,64))
$rowBytes=[int]($width/8);$rows=$bitmap.Height
# Send bounded raster stripes for low-memory thermal printers.
for($top=0;$top -lt $rows;$top+=128){$stripe=[Math]::Min(128,$rows-$top);$bytes.AddRange([byte[]](29,118,48,0,($rowBytes-band 255),($rowBytes-shr 8),($stripe-band 255),($stripe-shr 8)))
for($y=$top;$y -lt $top+$stripe;$y++){for($x=0;$x -lt $width;$x+=8){$value=0;for($bit=0;$bit -lt 8;$bit++){if($bitmap.GetPixel($x+$bit,$y).GetBrightness() -lt 0.65){$value=$value-bor (128-shr $bit)}};$bytes.Add([byte]$value)}}}
$bytes.AddRange([byte[]](10,10,10,29,86,0));if($document.drawer){$bytes.AddRange([byte[]](27,112,0,25,250))}
[IO.File]::WriteAllBytes($OutputFile,$bytes.ToArray());$bitmap.Dispose()
