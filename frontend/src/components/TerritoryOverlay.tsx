/**
 * TerritoryOverlay — Renders captured territory polygons on the map.
 * Each territory is color-coded: green for the current user, red for others.
 */

import React from 'react';
import { Polygon as MapPolygon } from 'react-native-maps';

interface TerritoryData {
    id: string;
    owner_id: string;
    area_sqm: number;
    coordinates: number[][] | null; // [lng, lat] pairs
    is_active: boolean;
}

interface Props {
    territories: TerritoryData[];
    currentUserId: string;
}

export default function TerritoryOverlay({ territories, currentUserId }: Props) {
    return (
        <>
            {territories.map((territory) => {
                if (!territory.coordinates || territory.coordinates.length < 3) return null;

                const isOwned = territory.owner_id === currentUserId;
                const coords = territory.coordinates.map((c) => ({
                    latitude: c[1],  // lat
                    longitude: c[0], // lng
                }));

                return (
                    <MapPolygon
                        key={territory.id}
                        coordinates={coords}
                        fillColor={
                            isOwned
                                ? 'rgba(0, 255, 136, 0.2)'  // Green: your territory
                                : 'rgba(255, 59, 48, 0.15)'  // Red: enemy territory
                        }
                        strokeColor={
                            isOwned ? '#00FF88' : '#FF3B30'
                        }
                        strokeWidth={2}
                        tappable={true}
                        onPress={() => {
                            // TODO: Show territory details popup
                            console.log(`Territory ${territory.id}: ${territory.area_sqm} sqm`);
                        }}
                    />
                );
            })}
        </>
    );
}
