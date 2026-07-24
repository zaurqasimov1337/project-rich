/**
 * Azərbaycan əməkhaqqı vergi/sığorta hesablanması — 2026 alqoritmi.
 * Bütün məbləğlər qəpiklə (minor units). Mənbə: istifadəçinin verdiyi rəsmi alqoritm.
 */

export type PayrollSector = 'private_nonoil' | 'state_oil';

export interface AzPayrollInput {
  /** Hesablanan aylıq əmək haqqı (qəpik) */
  grossQepik: number;
  sector?: PayrollSector;
  /** Güzəşt (qəpik) — vergiyə cəlb olunan məbləğdən çıxılır */
  exemptionQepik?: number;
  /** Həmkarlar təşkilatına üzvlük haqqı, faizlə (məs. 1 = 1%) */
  unionPct?: number;
}

export interface AzPayrollBreakdown {
  grossQepik: number;
  sector: PayrollSector;
  /** İşçidən tutulmalar */
  incomeTax: number;
  dsmfEmployee: number;
  unemploymentEmployee: number;
  healthEmployee: number;
  unionFee: number;
  totalEmployeeDeductions: number;
  /** İşçiyə çatan (net) */
  netQepik: number;
  /** İşəgötürən ayırmaları */
  dsmfEmployer: number;
  unemploymentEmployer: number;
  healthEmployer: number;
  totalEmployerContributions: number;
  /** İşəgötürənə cəmi məsrəf = gross + işəgötürən ayırmaları */
  totalEmployerCost: number;
}

const M = (azn: number) => Math.round(azn * 100); // AZN sabitlərini qəpiyə çevir
const r = Math.round;

export function calcAzPayroll(input: AzPayrollInput): AzPayrollBreakdown {
  const gross = Math.max(0, r(input.grossQepik));
  const sector: PayrollSector = input.sector ?? 'private_nonoil';
  const exemption = Math.max(0, r(input.exemptionQepik ?? 0));
  const taxable = Math.max(0, gross - exemption);
  const unionPct = Math.max(0, input.unionPct ?? 0);

  let incomeTax = 0;
  let dsmfEmployee = 0;
  let healthEmployee = 0;

  if (sector === 'private_nonoil') {
    // Gəlir vergisi
    if (taxable <= M(2500)) incomeTax = Math.max(0, r((taxable - M(200)) * 0.03));
    else if (taxable <= M(8000)) incomeTax = M(75) + r((gross - M(2500)) * 0.1);
    else incomeTax = M(625) + r((gross - M(8000)) * 0.14);
    // DSMF
    if (gross <= M(200)) dsmfEmployee = r(gross * 0.03);
    else if (gross <= M(8000)) dsmfEmployee = M(6) + r((gross - M(200)) * 0.1);
    else dsmfEmployee = M(786) + r((gross - M(8000)) * 0.1);
    // İcbari tibbi sığorta
    healthEmployee = gross <= M(2500) ? r(gross * 0.02) : M(50) + r((gross - M(2500)) * 0.005);
  } else {
    // Dövlət və neft-qaz sektoru
    if (taxable <= M(2500)) incomeTax = Math.max(0, r((taxable - M(200)) * 0.14));
    else incomeTax = M(350) + r((taxable - M(2500)) * 0.25);
    dsmfEmployee = r(gross * 0.03);
    healthEmployee = gross <= M(8000) ? r(gross * 0.02) : M(160) + r((gross - M(8000)) * 0.005);
  }

  const unemploymentEmployee = r(gross * 0.005);
  const unionFee = r((gross * unionPct) / 100);
  const totalEmployeeDeductions =
    incomeTax + dsmfEmployee + unemploymentEmployee + healthEmployee + unionFee;
  const netQepik = gross - totalEmployeeDeductions;

  // İşəgötürən ayırmaları (qüvvədə olan standart dərəcələr)
  let dsmfEmployer: number;
  if (sector === 'private_nonoil') {
    dsmfEmployer = gross <= M(200) ? r(gross * 0.22) : M(44) + r((gross - M(200)) * 0.15);
  } else {
    dsmfEmployer = r(gross * 0.22);
  }
  const unemploymentEmployer = r(gross * 0.005);
  const healthEmployer = gross <= M(8000) ? r(gross * 0.02) : M(160) + r((gross - M(8000)) * 0.005);
  const totalEmployerContributions = dsmfEmployer + unemploymentEmployer + healthEmployer;

  return {
    grossQepik: gross,
    sector,
    incomeTax,
    dsmfEmployee,
    unemploymentEmployee,
    healthEmployee,
    unionFee,
    totalEmployeeDeductions,
    netQepik,
    dsmfEmployer,
    unemploymentEmployer,
    healthEmployer,
    totalEmployerContributions,
    totalEmployerCost: gross + totalEmployerContributions,
  };
}
