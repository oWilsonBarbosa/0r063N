// Icosahedral partition of the sphere ("polyhedral mapping system").
// One vertex at the north pole (+Y, matching the dataset's y-up convention),
// giving 5 north-cap faces, 10 equatorial faces, and 5 south-cap faces.
//
// Face assignment uses argmax dot(faceCenter, p): for a regular icosahedron
// the perpendicular-bisector great circle of two adjacent face centers is
// exactly the plane of their shared edge, so this is an exact
// point-in-spherical-triangle partition.

const DEG = Math.PI / 180;

function fromLatLon(latDeg, lonDeg) {
    const lat = latDeg * DEG, lon = lonDeg * DEG;
    // dataset convention: lat = asin(y), lon = atan2(x, z)
    return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

function normalize(v) {
    const m = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / m, v[1] / m, v[2] / m];
}

function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function buildIcosahedron() {
    const ringLat = Math.atan(0.5) / DEG;      // ~26.5651 deg
    const verts = [fromLatLon(90, 0)];          // 0: north pole
    for (let i = 0; i < 5; i++) verts.push(fromLatLon(ringLat, 72 * i));        // 1..5 upper ring
    for (let i = 0; i < 5; i++) verts.push(fromLatLon(-ringLat, 72 * i + 36));  // 6..10 lower ring
    verts.push(fromLatLon(-90, 0));             // 11: south pole

    const U = i => 1 + (i % 5);
    const L = i => 6 + (i % 5);
    const tris = [];
    for (let i = 0; i < 5; i++) tris.push([0, U(i), U(i + 1)]);          // north cap
    for (let i = 0; i < 5; i++) tris.push([U(i), L(i), U(i + 1)]);       // upper equatorial
    for (let i = 0; i < 5; i++) tris.push([L(i), L(i + 1), U(i + 1)]);   // lower equatorial
    for (let i = 0; i < 5; i++) tris.push([11, L(i + 1), L(i)]);         // south cap

    let faces = tris.map(tri => {
        const center = normalize([
            verts[tri[0]][0] + verts[tri[1]][0] + verts[tri[2]][0],
            verts[tri[0]][1] + verts[tri[1]][1] + verts[tri[2]][1],
            verts[tri[0]][2] + verts[tri[1]][2] + verts[tri[2]][2],
        ]);
        const lat = Math.asin(center[1]) / DEG;
        const lon = Math.atan2(center[0], center[2]) / DEG;
        return { tri, corners: tri.map(i => verts[i]), center, lat, lon };
    });

    // Region numbering: descending center latitude, then ascending longitude.
    faces.sort((a, b) => (b.lat - a.lat) || (a.lon - b.lon));
    faces.forEach((f, i) => { f.region = i; });

    // Local tangent frame for gnomonic projection / quadrants (north-aligned).
    for (const f of faces) {
        f.east = normalize(cross([0, 1, 0], f.center));
        f.north = normalize(cross(f.center, f.east));
    }
    return { verts, faces };
}

// region index (0..19) for a unit vector
export function assignRegion(faces, x, y, z) {
    let best = 0, bestDot = -2;
    for (let i = 0; i < 20; i++) {
        const c = faces[i].center;
        const d = c[0] * x + c[1] * y + c[2] * z;
        if (d > bestDot) { bestDot = d; best = i; }
    }
    return best;
}

export function assignAllRegions(faces, xs, ys, zs) {
    const n = xs.length;
    const out = new Uint8Array(n);
    const cx = new Float64Array(20), cy = new Float64Array(20), cz = new Float64Array(20);
    for (let i = 0; i < 20; i++) {
        [cx[i], cy[i], cz[i]] = faces[i].center;
    }
    for (let r = 0; r < n; r++) {
        const x = xs[r], y = ys[r], z = zs[r];
        let best = 0, bestDot = -2;
        for (let i = 0; i < 20; i++) {
            const d = cx[i] * x + cy[i] * y + cz[i] * z;
            if (d > bestDot) { bestDot = d; best = i; }
        }
        out[r] = best;
    }
    return out;
}

// Gnomonic projection onto the tangent plane at the face center.
// Returns [X (east), Y (north)] or null for points on the far hemisphere.
export function gnomonicForward(face, p) {
    const d = dot(p, face.center);
    if (d <= 0.05) return null;
    const t = [p[0] / d, p[1] / d, p[2] / d];
    return [dot(t, face.east), dot(t, face.north)];
}

// Inverse gnomonic: plane coords -> unit vector -> [latDeg, lonDeg]
export function gnomonicInverse(face, X, Y) {
    const p = normalize([
        face.center[0] + X * face.east[0] + Y * face.north[0],
        face.center[1] + X * face.east[1] + Y * face.north[1],
        face.center[2] + X * face.east[2] + Y * face.north[2],
    ]);
    return [Math.asin(p[1]) / DEG, Math.atan2(p[0], p[2]) / DEG];
}

// Quadrant of a lat/lon point relative to the face center: 0=NW 1=NE 2=SW 3=SE
export const QUADRANT_NAMES = ['NW', 'NE', 'SW', 'SE'];

export function quadrantOf(face, latDeg, lonDeg) {
    const p = fromLatLon(latDeg, lonDeg);
    const g = gnomonicForward(face, p);
    if (!g) return 0;
    const [X, Y] = g;
    return (Y >= 0 ? 0 : 2) + (X >= 0 ? 1 : 0);
}

export { fromLatLon, normalize, cross, dot };
