/**
 * TerritoryOverlay (Web fallback) — No-op since react-native-maps is native-only.
 */

import React from 'react';

interface TerritoryData {
    id: string;
    owner_id: string;
    area_sqm: number;
    coordinates: number[][] | null;
    is_active: boolean;
}

interface Props {
    territories: TerritoryData[];
    currentUserId: string;
    ownTerritoryColor?: string;
}

export default function TerritoryOverlay(_props: Props) {
    return null;
}
