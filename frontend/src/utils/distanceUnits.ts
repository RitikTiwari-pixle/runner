/**
 * Distance conversion utilities
 * Support: km, miles, meters, feet, nautical miles
 */

export type DistanceUnit = 'km' | 'mi' | 'm' | 'ft' | 'nm';

const UNIT_LABELS: Record<DistanceUnit, string> = {
    km: 'Kilometers',
    mi: 'Miles',
    m: 'Meters',
    ft: 'Feet',
    nm: 'Nautical Miles',
};

const UNIT_SHORT: Record<DistanceUnit, string> = {
    km: 'km',
    mi: 'mi',
    m: 'm',
    ft: 'ft',
    nm: 'nm',
};

/**
 * Convert meters to specified unit
 * @param meters - Distance in meters
 * @param toUnit - Target unit
 * @param decimals - Decimal places
 */
export function convertDistance(meters: number, toUnit: DistanceUnit, decimals = 1): string {
    let value: number;

    switch (toUnit) {
        case 'km':
            value = meters / 1000;
            break;
        case 'mi':
            value = (meters / 1000) * 0.621371;
            break;
        case 'm':
            value = meters;
            break;
        case 'ft':
            value = meters * 3.28084;
            break;
        case 'nm':
            value = (meters / 1000) * 0.539957;
            break;
        default:
            value = meters / 1000;
    }

    return `${value.toFixed(decimals)} ${UNIT_SHORT[toUnit]}`;
}

/**
 * Format distance with unit name
 */
export function formatDistanceWithUnit(meters: number, unit: DistanceUnit, decimals = 1): string {
    let value: number;

    switch (unit) {
        case 'km':
            value = meters / 1000;
            break;
        case 'mi':
            value = (meters / 1000) * 0.621371;
            break;
        case 'm':
            value = meters;
            break;
        case 'ft':
            value = meters * 3.28084;
            break;
        case 'nm':
            value = (meters / 1000) * 0.539957;
            break;
        default:
            value = meters / 1000;
    }

    return `${value.toFixed(decimals)} ${UNIT_LABELS[unit]}`;
}

/**
 * Convert from one unit to another
 */
export function convertBetweenUnits(value: number, fromUnit: DistanceUnit, toUnit: DistanceUnit, decimals = 1): string {
    // Convert to meters first
    let meters: number;

    switch (fromUnit) {
        case 'km':
            meters = value * 1000;
            break;
        case 'mi':
            meters = (value / 0.621371) * 1000;
            break;
        case 'm':
            meters = value;
            break;
        case 'ft':
            meters = value / 3.28084;
            break;
        case 'nm':
            meters = (value / 0.539957) * 1000;
            break;
        default:
            meters = value * 1000;
    }

    // Then convert to target unit
    return convertDistance(meters, toUnit, decimals);
}

/**
 * Get all available units
 */
export function getAvailableUnits(): { unit: DistanceUnit; label: string; short: string }[] {
    return [
        { unit: 'km', label: UNIT_LABELS.km, short: UNIT_SHORT.km },
        { unit: 'mi', label: UNIT_LABELS.mi, short: UNIT_SHORT.mi },
        { unit: 'm', label: UNIT_LABELS.m, short: UNIT_SHORT.m },
        { unit: 'ft', label: UNIT_LABELS.ft, short: UNIT_SHORT.ft },
        { unit: 'nm', label: UNIT_LABELS.nm, short: UNIT_SHORT.nm },
    ];
}

/**
 * Get unit label
 */
export function getUnitLabel(unit: DistanceUnit): string {
    return UNIT_LABELS[unit] || 'Unknown';
}

/**
 * Get short unit name
 */
export function getUnitShort(unit: DistanceUnit): string {
    return UNIT_SHORT[unit] || '';
}

/**
 * Get next unit in cycle (for settings toggle)
 */
export function getNextUnit(current: DistanceUnit): DistanceUnit {
    const units: DistanceUnit[] = ['km', 'mi', 'm', 'ft', 'nm'];
    const index = units.indexOf(current);
    return units[(index + 1) % units.length];
}
