export function evaluateArithmetic(input: string): number | null {
  const expression = input.replaceAll(',', '').replaceAll('×', '*').replaceAll('÷', '/')
  let index = 0

  function skipSpaces() {
    while (/\s/.test(expression[index] ?? '')) index += 1
  }

  function parseNumber(): number | null {
    skipSpaces()
    const match = expression.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/)
    if (!match) return null
    index += match[0].length
    return Number(match[0])
  }

  function parseFactor(): number | null {
    skipSpaces()
    const sign = expression[index] === '-' || expression[index] === '+' ? expression[index++] : '+'
    skipSpaces()

    let value: number | null
    if (expression[index] === '(') {
      index += 1
      value = parseExpression()
      skipSpaces()
      if (value === null || expression[index] !== ')') return null
      index += 1
    } else {
      value = parseNumber()
    }

    return value === null ? null : sign === '-' ? -value : value
  }

  function parseTerm(): number | null {
    let value = parseFactor()
    if (value === null) return null

    while (true) {
      skipSpaces()
      const operator = expression[index]
      if (operator !== '*' && operator !== '/') break
      index += 1
      const right = parseFactor()
      if (right === null || (operator === '/' && right === 0)) return null
      value = operator === '*' ? value * right : value / right
    }
    return value
  }

  function parseExpression(): number | null {
    let value = parseTerm()
    if (value === null) return null

    while (true) {
      skipSpaces()
      const operator = expression[index]
      if (operator !== '+' && operator !== '-') break
      index += 1
      const right = parseTerm()
      if (right === null) return null
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  if (!expression.trim()) return null
  const result = parseExpression()
  skipSpaces()
  return result !== null && index === expression.length && Number.isFinite(result) ? result : null
}
