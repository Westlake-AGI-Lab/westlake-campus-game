// Deterministic room ambience derived from the authoritative snapshot clock.
export const DAY_MS=24*60*1000,WEATHER_MS=6*60*1000;
export type Weather='clear'|'cloudy'|'rain';
export function atmosphereAt(time:number){
 const t=Number.isFinite(time)?time:0,hour=((t%DAY_MS+DAY_MS)%DAY_MS)/DAY_MS*24;
 const daylight=Math.max(0,Math.sin((hour-6)/24*Math.PI*2));
 const slot=Math.floor(t/WEATHER_MS),weather:Weather=(['clear','cloudy','clear','rain','cloudy','clear'] as Weather[])[((slot%6)+6)%6];
 return {hour,daylight,night:hour<5||hour>=21,weather};
}
