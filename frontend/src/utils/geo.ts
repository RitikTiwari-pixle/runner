/**
 * Geospatial utilities — haversine distance and pace formatting.
 */

/**
 * Haversine formula: great-circle distance between two GPS coords in meters.
 */
export function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6_371_000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute total distance from an array of coordinate objects.
 */
export function totalDistance(
    coords: { latitude: number; longitude: number }[]
): number {
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        total += haversineDistance(
            coords[i - 1].latitude, coords[i - 1].longitude,
            coords[i].latitude, coords[i].longitude
        );
    }
    return total;
}

/**
 * Format seconds into MM:SS per km pace string.
 * e.g. 330 → "5:30"
 */
export function formatPace(secondsPerKm: number): string {
    if (!secondsPerKm || !isFinite(secondsPerKm) || secondsPerKm <= 0) return '--:--';
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds into HH:MM:SS or MM:SS duration string.
 */
export function formatDuration(totalSeconds: number): string {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format meters to display string. Under 1000m shows meters, otherwise km.
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
}
