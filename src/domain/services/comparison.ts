import Big from 'big.js';
import { formatMoney } from './money';

export type ComparisonMode = 'weight' | 'volume' | 'units';
export type ComparisonUnit = 'g' | 'kg' | 'ml' | 'L' | 'un';
export interface PackageInput { price: string; content: string; unit: ComparisonUnit }
export type PackagePair = [PackageInput, PackageInput];
export type PackageErrors = Partial<Record<keyof PackageInput, string>>;
export type ComparisonResult =
  | { status: 'incomplete' | 'invalid'; errors: [PackageErrors, PackageErrors] }
  | { status: 'ready'; winner: 'A' | 'B' | 'tie'; reference: 'kg' | 'L' | 'un'; unitPrices: [string, string]; saving: string | null; savingPercent: string | null };

export const MODE_UNITS: Record<ComparisonMode, readonly ComparisonUnit[]> = {
  weight: ['g', 'kg'], volume: ['ml', 'L'], units: ['un'],
};

export function emptyPackages(mode: ComparisonMode): PackagePair {
  const unit = MODE_UNITS[mode][0];
  return [{ price: '', content: '', unit }, { price: '', content: '', unit }];
}

function decimal(raw: string, places: number): Big | null {
  const value = raw.trim().replace(',', '.');
  if (!value || value.length > 100 || !new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(value)) return null;
  const result = new Big(value);
  return result.gt(0) ? result : null;
}

// Both operands are positive integers. Round the rational value without division precision loss.
function roundedRatio(numerator: Big, denominator: Big): bigint {
  const n = BigInt(numerator.toFixed(0)), d = BigInt(denominator.toFixed(0));
  return (2n * n + d) / (2n * d);
}

function moneyRatio(numerator: Big, denominator: Big): string {
  return numerator.lt(denominator) ? 'menos de R$ 0,01' : formatMoney(roundedRatio(numerator, denominator));
}

export function comparePackages(mode: ComparisonMode, options: PackagePair): ComparisonResult {
  const errors: [PackageErrors, PackageErrors] = [{}, {}];
  const normalized: { numerator: Big; denominator: Big }[] = [];
  let invalid = false;
  options.forEach((option, index) => {
    const error = errors[index];
    const price = decimal(option.price, 2);
    const content = decimal(option.content, 3);
    if (!price || price.times(100).gt(Number.MAX_SAFE_INTEGER)) {
      error.price = option.price.trim() ? 'Use um preço positivo, com até duas casas decimais, sem separador de milhares, dentro do limite permitido.' : 'Informe o preço da embalagem.';
      if (option.price.trim()) invalid = true;
    }
    if (!content || (mode === 'units' && !/^\d+$/.test(option.content.trim()))) {
      error.content = option.content.trim() ? (mode === 'units' ? 'Informe uma quantidade inteira maior que zero.' : 'Use um conteúdo positivo, com até três casas decimais, sem separador de milhares.') : 'Informe o conteúdo da embalagem.';
      if (option.content.trim()) invalid = true;
    }
    if (!MODE_UNITS[mode].includes(option.unit)) {
      error.unit = 'Escolha uma unidade compatível com o tipo de comparação.';
      invalid = true;
    }
    if (price && content && !Object.keys(error).length) {
      const factor = option.unit === 'kg' || option.unit === 'L' ? 1000000 : 1000;
      normalized.push({
        numerator: price.times(100).times(mode === 'units' ? 1000 : 1000000),
        denominator: content.times(factor),
      });
    }
  });
  if (normalized.length !== 2) return { status: invalid ? 'invalid' : 'incomplete', errors };
  const [a, b] = normalized;
  const crossA = a.numerator.times(b.denominator), crossB = b.numerator.times(a.denominator);
  const order = crossA.cmp(crossB);
  const winner = order === 0 ? 'tie' : order < 0 ? 'A' : 'B';
  const reference = mode === 'weight' ? 'kg' : mode === 'volume' ? 'L' : 'un';
  const unitPrices: [string, string] = [moneyRatio(a.numerator, a.denominator), moneyRatio(b.numerator, b.denominator)];
  if (winner === 'tie') return { status: 'ready', winner, reference, unitPrices, saving: null, savingPercent: null };
  const high = order < 0 ? crossB : crossA, low = order < 0 ? crossA : crossB;
  const difference = high.minus(low);
  const tenths = roundedRatio(difference.times(1000), high);
  const savingPercent = difference.times(1000).lt(high) ? 'menos de 0,1%' : tenths >= 1000n ? 'mais de 99,9%' : `${(Number(tenths) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return {
    status: 'ready', winner, reference, unitPrices,
    saving: moneyRatio(difference, a.denominator.times(b.denominator)),
    savingPercent,
  };
}
