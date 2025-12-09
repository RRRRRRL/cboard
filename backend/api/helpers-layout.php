<?php
/**
 * Layout Template Helpers
 * Sprint 3: Support for different layout templates (1x1, 1x5, 4x6, etc.)
 */

/**
 * Get layout dimensions for a template
 */
function getLayoutDimensions($layoutType) {
    $layouts = [
        '1x1' => ['rows' => 1, 'cols' => 1, 'total' => 1],
        '1x2' => ['rows' => 1, 'cols' => 2, 'total' => 2],
        '1x3' => ['rows' => 1, 'cols' => 3, 'total' => 3],
        '1x4' => ['rows' => 1, 'cols' => 4, 'total' => 4],
        '1x5' => ['rows' => 1, 'cols' => 5, 'total' => 5],
        '2x2' => ['rows' => 2, 'cols' => 2, 'total' => 4],
        '2x3' => ['rows' => 2, 'cols' => 3, 'total' => 6],
        '3x3' => ['rows' => 3, 'cols' => 3, 'total' => 9],
        '3x4' => ['rows' => 3, 'cols' => 4, 'total' => 12],
        '4x4' => ['rows' => 4, 'cols' => 4, 'total' => 16],
        '4x5' => ['rows' => 4, 'cols' => 5, 'total' => 20],
        '4x6' => ['rows' => 4, 'cols' => 6, 'total' => 24],
        '5x5' => ['rows' => 5, 'cols' => 5, 'total' => 25],
        '6x6' => ['rows' => 6, 'cols' => 6, 'total' => 36],
        'grid' => ['rows' => 4, 'cols' => 6, 'total' => 24] // Default grid
    ];
    
    return $layouts[$layoutType] ?? $layouts['4x6'];
}

/**
 * Validate card position for a layout
 */
function validateCardPosition($layoutType, $rowIndex, $colIndex) {
    $dimensions = getLayoutDimensions($layoutType);
    
    if ($rowIndex < 0 || $rowIndex >= $dimensions['rows']) {
        return false;
    }
    
    if ($colIndex < 0 || $colIndex >= $dimensions['cols']) {
        return false;
    }
    
    return true;
}

/**
 * Get available layout templates
 */
function getAvailableLayouts() {
    return [
        ['value' => '1x1', 'label' => '1x1 (Single Card)', 'rows' => 1, 'cols' => 1],
        ['value' => '1x2', 'label' => '1x2 (2 Cards)', 'rows' => 1, 'cols' => 2],
        ['value' => '1x3', 'label' => '1x3 (3 Cards)', 'rows' => 1, 'cols' => 3],
        ['value' => '1x4', 'label' => '1x4 (4 Cards)', 'rows' => 1, 'cols' => 4],
        ['value' => '1x5', 'label' => '1x5 (5 Cards)', 'rows' => 1, 'cols' => 5],
        ['value' => '2x2', 'label' => '2x2 (4 Cards)', 'rows' => 2, 'cols' => 2],
        ['value' => '2x3', 'label' => '2x3 (6 Cards)', 'rows' => 2, 'cols' => 3],
        ['value' => '3x3', 'label' => '3x3 (9 Cards)', 'rows' => 3, 'cols' => 3],
        ['value' => '3x4', 'label' => '3x4 (12 Cards)', 'rows' => 3, 'cols' => 4],
        ['value' => '4x4', 'label' => '4x4 (16 Cards)', 'rows' => 4, 'cols' => 4],
        ['value' => '4x5', 'label' => '4x5 (20 Cards)', 'rows' => 4, 'cols' => 5],
        ['value' => '4x6', 'label' => '4x6 (24 Cards)', 'rows' => 4, 'cols' => 6],
        ['value' => '5x5', 'label' => '5x5 (25 Cards)', 'rows' => 5, 'cols' => 5],
        ['value' => '6x6', 'label' => '6x6 (36 Cards)', 'rows' => 6, 'cols' => 6],
        ['value' => 'grid', 'label' => 'Grid (Custom)', 'rows' => 4, 'cols' => 6]
    ];
}

