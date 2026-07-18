import { decodePlanetCode } from '../../third_party/planet_heightmap_generation/js/planet-code.js';

const code = process.argv[2] ?? '06cy8w6z6a89kow6psje93';
const decoded = decodePlanetCode(code);
if (!decoded) {
  throw new Error(`Unable to decode planet code: ${code}`);
}
console.log(JSON.stringify(decoded, null, 2));
