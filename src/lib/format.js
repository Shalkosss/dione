/* DIONE · format.js — helpers de formato */

export const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";

export const pctSigned = (x, d = 1) =>
  (x >= 0 ? "+" : "") + (x * 100).toFixed(d) + "%";

export const num = (x, d = 2) => Number(x).toFixed(d);

export const money = (x) => {
  const v = Math.round(x);
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US");
};

export const moneySigned = (x) => (x >= 0 ? "+" : "") + money(x);
