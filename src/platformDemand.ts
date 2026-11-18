// 2019 TfL annualised DLR entries + exits, in millions (London Assembly, Q2022/0209).
// All-year station weights; the intraday profile, directional split and flight transfers are modelled.
const millions: Record<string, number> = {
  ABB: 1.22, ALL: 2.11, BNK: 30.50, BCK: 2.36, BKP: 0.51, BLW: 1.97, BOW: 3.55,
  CAW: 18.32, CNT: 13.57, CRH: 4.26, CUH: 2.21, CUT: 7.08, CYP: 1.99, DEP: 4.21,
  DEV: 2.62, EIR: 3.88, ELV: 1.70, GAL: 1.42, GRE: 4.85, HER: 8.15, ISG: 2.71,
  KGV: 1.86, LAN: 4.41, LEW: 9.66, LIM: 9.78, LCA: 4.68, MUD: 2.12, PDK: 3.18,
  POP: 4.97, PRR: 2.44, PML: 0.86, RAL: 1.82, RVC: 3.97, SHA: 8.86, SQY: 6.50,
  STL: 1.50, STR: 10.45, SHS: 1.18, STI: 3.93, TWG: 4.91, WHM: 3.52, WIQ: 1.31,
  WSV: 1.90, WFE: 5.27, WOO: 14.59,
};

export function demandFactor(day: string, seconds: number) {
  const hour = seconds % 86400 / 3600;
  if (hour < 5 || hour >= 23) return 0.12;
  if (hour < 6 || hour >= 21) return 0.42;
  if (day === 'SAT' || day === 'SUN') return hour >= 10 && hour < 18 ? 1.05 : 0.65;
  return (hour >= 7 && hour < 10) || (hour >= 16 && hour < 19) ? 1.8 : 0.92;
}

export function entriesPerSecond(station: string) {
  // Half are entries, averaged over 18 service hours. LCY flight cohorts supply part of its traffic.
  return (millions[station] ?? 0) * 1e6 / (2 * 365 * 18 * 3600) * (station === 'LCA' ? 0.65 : 1);
}
