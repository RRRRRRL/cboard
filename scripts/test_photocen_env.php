<?php
// Quick test for PHOTOCEN_OCR_ENABLED parsing
function show($val) {
    if ($val === null) {
        // Unset the variable
        putenv('PHOTOCEN_OCR_ENABLED');
    } else {
        putenv('PHOTOCEN_OCR_ENABLED=' . $val);
    }

    $envVal = getenv('PHOTOCEN_OCR_ENABLED');
    if ($envVal === false || $envVal === null) {
        $photocen_enabled = true;
    } else {
        $parsed = filter_var($envVal, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $photocen_enabled = ($parsed === null) ? false : $parsed;
    }

    echo str_pad(var_export($envVal, true), 10) . " => enabled=" . ($photocen_enabled ? 'true' : 'false') . PHP_EOL;
}

$values = ['true','false','1','0','on','off','yes','no','random','', null];
foreach ($values as $v) show($v);
