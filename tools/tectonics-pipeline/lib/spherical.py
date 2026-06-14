"""Spherical geometry helpers: lat/lon <-> unit vectors, Rodrigues rotations."""

import numpy as np

PLANET_RADIUS_KM = 6371.0  # Earth-like radius assumed by the generator's km scaling


def latlon_to_xyz(lat_deg, lon_deg):
    """Match the export convention: lat = asin(y), lon = atan2(x, z)."""
    lat = np.radians(np.asarray(lat_deg, dtype=np.float64))
    lon = np.radians(np.asarray(lon_deg, dtype=np.float64))
    y = np.sin(lat)
    c = np.cos(lat)
    x = c * np.sin(lon)
    z = c * np.cos(lon)
    return np.stack([x, y, z], axis=-1)


def xyz_to_latlon(v):
    v = np.asarray(v, dtype=np.float64)
    n = v / np.linalg.norm(v, axis=-1, keepdims=True)
    lat = np.degrees(np.arcsin(np.clip(n[..., 1], -1, 1)))
    lon = np.degrees(np.arctan2(n[..., 0], n[..., 2]))
    return lat, lon


def rotation_matrix(pole_lat, pole_lon, angle_deg):
    """Rodrigues rotation matrix about the axis through (pole_lat, pole_lon)."""
    k = latlon_to_xyz(pole_lat, pole_lon).reshape(3)
    a = np.radians(angle_deg)
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * (K @ K)


def rotate_latlon(lat_deg, lon_deg, pole_lat, pole_lon, angle_deg):
    R = rotation_matrix(pole_lat, pole_lon, angle_deg)
    v = latlon_to_xyz(lat_deg, lon_deg)
    return xyz_to_latlon(v @ R.T)


def great_circle_km(lat1, lon1, lat2, lon2, radius_km=PLANET_RADIUS_KM):
    v1 = latlon_to_xyz(lat1, lon1)
    v2 = latlon_to_xyz(lat2, lon2)
    dot = np.clip(np.sum(v1 * v2, axis=-1), -1, 1)
    return np.arccos(dot) * radius_km


def cm_per_yr(distance_km, myr):
    """Convert displacement over a time span to a mean rate in cm/yr."""
    return distance_km * 1e5 / (myr * 1e6)
