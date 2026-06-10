import { createContext, useContext, useState } from 'react'
import type React from 'react'

export type Currency = 'INR' | 'USD'

const USD_TO_INR = 83.5

interface CurrencyCtx {
  currency: Currency
  setCurrency: (c: Currency) => void
  format: (inrValue: number) => string
  toDisplay: (inrValue: number) => number
  fromInput: (value: number, inputCurrency: Currency) => number
  symbol: string
  rate: number
}

const Ctx = createContext<CurrencyCtx | null>(null)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('INR')

  const toDisplay = (inrValue: number) =>
    currency === 'INR' ? inrValue : +(inrValue / USD_TO_INR).toFixed(2)

  const fromInput = (value: number, inputCurrency: Currency) =>
    inputCurrency === 'INR' ? value : value * USD_TO_INR

  const symbol = currency === 'INR' ? '₹' : '$'

  const format = (inrValue: number) => {
    const val = toDisplay(inrValue)
    if (val >= 10000000) return `${symbol}${(val / 10000000).toFixed(1)}Cr`
    if (val >= 100000)   return `${symbol}${(val / 100000).toFixed(1)}L`
    if (val >= 1000)     return `${symbol}${(val / 1000).toFixed(0)}k`
    return `${symbol}${val.toLocaleString()}`
  }

  return (
    <Ctx.Provider value={{ currency, setCurrency, format, toDisplay, fromInput, symbol, rate: USD_TO_INR }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCurrency must be inside CurrencyProvider')
  return ctx
}
