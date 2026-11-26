/**
 * 100% Offline Astronomical Prayer Times Engine
 * Calculates Fajr, Sunrise, Dhuhr, Asr (Hanafi/Shafi), Maghrib, Isha, Sehri & Iftar
 * from latitude, longitude, date, timezone offset, calculation method, and madhab.
 */

export type CalculationMethod = 'Karachi' | 'MWL' | 'ISNA' | 'Makkah' | 'Egypt';
export type AsrMadhab = 'Hanafi' | 'Shafi';

export interface OfflinePrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  SehriEnd: string;
  Iftar: string;
}

export interface CityPreset {
  name: string;
  lat: number;
  lng: number;
  tz: number; // UTC offset in hours
}

export const CITY_PRESETS: CityPreset[] = [
  { name: 'ঢাকা', lat: 23.8103, lng: 90.4125, tz: 6 },
  { name: 'চট্টগ্রাম', lat: 22.3569, lng: 91.7832, tz: 6 },
  { name: 'সিলেট', lat: 24.8949, lng: 91.8687, tz: 6 },
  { name: 'রাজশাহী', lat: 24.3745, lng: 88.6042, tz: 6 },
  { name: 'খুলনা', lat: 22.8456, lng: 89.5403, tz: 6 },
  { name: 'বরিশাল', lat: 22.701, lng: 90.3535, tz: 6 },
  { name: 'রংপুর', lat: 25.7439, lng: 89.2752, tz: 6 },
  { name: 'মক্কা', lat: 21.4225, lng: 39.8262, tz: 3 },
  { name: 'মদীনা', lat: 24.5247, lng: 39.5692, tz: 3 },
  { name: 'লন্ডন', lat: 51.5072, lng: -0.1276, tz: 0 },
  { name: 'নিউ ইয়র্ক', lat: 40.7128, lng: -74.006, tz: -5 },
];

const METHOD_PARAMS: Record<CalculationMethod, { fajr: number; ishaAngle?: number; ishaMin?: number }> = {
  Karachi: { fajr: 18, ishaAngle: 18 },
  MWL: { fajr: 18, ishaAngle: 17 },
  ISNA: { fajr: 15, ishaAngle: 15 },
  Makkah: { fajr: 18.5, ishaMin: 90 },
  Egypt: { fajr: 19.5, ishaAngle: 17.5 },
};

const dtr = (d: number) => (d * Math.PI) / 180;
const rtd = (r: number) => (r * 180) / Math.PI;
const fixHour = (h: number) => ((h % 24) + 24) % 24;
const fixAngle = (a: number) => ((a % 360) + 360) % 360;

function julianDate(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * Math.sin(dtr(g)) + 0.02 * Math.sin(dtr(2 * g)));
  const e = 23.439 - 0.00000036 * D;

  const RA = rtd(Math.atan2(Math.cos(dtr(e)) * Math.sin(dtr(L)), Math.cos(dtr(L)))) / 15;
  const eqt = q / 15 - fixHour(RA);
  const decl = rtd(Math.asin(Math.sin(dtr(e)) * Math.sin(dtr(L))));
  return { decl, eqt };
}

function sunAngleTime(jd: number, lat: number, angle: number, direction: 'ccw' | 'cw'): number {
  const { decl } = sunPosition(jd);
  const num = -Math.sin(dtr(angle)) - Math.sin(dtr(lat)) * Math.sin(dtr(decl));
  const den = Math.cos(dtr(lat)) * Math.cos(dtr(decl));
  const cosVal = Math.max(-1, Math.min(1, num / den));
  const t = rtd(Math.acos(cosVal)) / 15;
  const noon = midDay(jd);
  return direction === 'ccw' ? noon - t : noon + t;
}

function midDay(jd: number): number {
  const { eqt } = sunPosition(jd);
  return fixHour(12 - eqt);
}

function asrTime(jd: number, lat: number, factor: number): number {
  const { decl } = sunPosition(jd);
  const angle = -rtd(Math.atan(1 / (factor + Math.tan(dtr(Math.abs(lat - decl))))));
  return sunAngleTime(jd, lat, angle, 'cw');
}

function formatTime24(hours: number): string {
  const totalMins = Math.round(fixHour(hours) * 60);
  const hh = Math.floor(totalMins / 60) % 24;
  const mm = totalMins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function computeOfflinePrayerTimes(
  date: Date,
  lat: number,
  lng: number,
  tzHours: number,
  method: CalculationMethod = 'Karachi',
  madhab: AsrMadhab = 'Hanafi'
): OfflinePrayerTimes {
  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
  const params = METHOD_PARAMS[method];
  const asrFactor = madhab === 'Hanafi' ? 2 : 1;

  // Iterative refinement using day fractional offsets
  const fajrRaw = sunAngleTime(jd + 5 / 24, lat, params.fajr, 'ccw');
  const sunriseRaw = sunAngleTime(jd + 6 / 24, lat, 0.833, 'ccw');
  const dhuhrRaw = midDay(jd + 12 / 24);
  const asrRaw = asrTime(jd + 15 / 24, lat, asrFactor);
  const maghribRaw = sunAngleTime(jd + 18 / 24, lat, 0.833, 'cw');
  const ishaRaw = params.ishaMin
    ? maghribRaw + params.ishaMin / 60
    : sunAngleTime(jd + 19 / 24, lat, params.ishaAngle || 18, 'cw');

  const adj = tzHours - lng / 15;
  const fajr = fajrRaw + adj;
  const sunrise = sunriseRaw + adj;
  const dhuhr = dhuhrRaw + adj + 2 / 60; // +2 min safety margin after zenith
  const asr = asrRaw + adj;
  const maghrib = maghribRaw + adj;
  const isha = ishaRaw + adj;

  return {
    Fajr: formatTime24(fajr),
    Sunrise: formatTime24(sunrise),
    Dhuhr: formatTime24(dhuhr),
    Asr: formatTime24(asr),
    Maghrib: formatTime24(maghrib),
    Isha: formatTime24(isha),
    SehriEnd: formatTime24(fajr - 5 / 60), // 5 mins caution before Fajr
    Iftar: formatTime24(maghrib),
  };
}
