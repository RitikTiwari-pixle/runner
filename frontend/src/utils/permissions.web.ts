/**
 * Permissions (Web fallback)
 * On web, browser handles geolocation permissions automatically
 * via the Geolocation API prompt.
 */

export interface PermissionStatus {
    locationForeground: boolean;
    locationBackground: boolean;
    notifications: boolean;
}

export async function requestLocationPermissions(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => resolve(true),
                () => resolve(false),
                { timeout: 5000 }
            );
        });
    }
    return false;
}

export async function checkLocationPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
}> {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        try {
            const result = await (navigator as any).permissions.query({ name: 'geolocation' });
            return {
                foreground: result.state === 'granted',
                background: false, // Not applicable on web
            };
        } catch {
            return { foreground: false, background: false };
        }
    }
    return { foreground: false, background: false };
}

export async function requestNotificationPermissions(): Promise<boolean> {
    return true;
}

export async function checkNotificationPermissions(): Promise<boolean> {
    return true;
}

export async function checkAllPermissions(): Promise<PermissionStatus> {
    const location = await checkLocationPermissions();
    const notifications = await checkNotificationPermissions();
    return {
        locationForeground: location.foreground,
        locationBackground: location.background,
        notifications,
    };
}
